.PHONY: format-terraform validate security test help clean dev build lint format-frontend test-unit test-e2e test-e2e-debug test-component format-check push-test install pnpm setup-dev format go-build deploy-lambdas-test deploy-lambdas-prod

default: help

PROJECT ?= dnd-planner
AWS_PROFILE ?= dnd-planner
ENVS := test prod
export AWS_PROFILE
AWS_ACCOUNT := $(shell AWS_PROFILE=$(AWS_PROFILE) aws sts get-caller-identity --query Account --output text 2>/dev/null)
AWS_DEFAULT_REGION ?= ap-southeast-2
AWS_REGION := $(shell AWS_PROFILE=$(AWS_PROFILE) aws configure get region 2>/dev/null || echo "$(AWS_DEFAULT_REGION)")
export AWS_REGION
STATE_BUCKET ?= $(PROJECT)-iac-state-$(AWS_ACCOUNT)
GH_WORKSPACE := $(shell gh repo view --json owner -q .owner.login 2>/dev/null)
GH_REPO := $(PROJECT)

# Lambda build configuration
LAMBDAS := $(notdir $(wildcard backend/cmd/*))
LAMBDA_BINARIES := $(addsuffix /bootstrap,$(addprefix build/lambdas/,$(LAMBDAS)))

# Generic init for any environment
.PRECIOUS: terraform/environment/%/.terraform
terraform/environment/%/.terraform:
	@echo "Initializing Terraform for $*..."
	cd terraform/environment/$* && \
	terraform init \
		-backend-config="bucket=$(STATE_BUCKET)" \
		-backend-config="key=$(PROJECT)/$*/terraform.tfstate"

# tfplan file creation rule (generic)
terraform/environment/%/tfplan: terraform/environment/% terraform/environment/%/.terraform terraform/environment/%/.stamp
	cd terraform/environment/$* && terraform plan \
		-var="workspace=$(GH_WORKSPACE)" \
		-var="repo=$(GH_REPO)" \
		-out=tfplan
	[ -f tfplan ] || touch tfplan

# Generic apply for any environment (depends on tfplan file)
terraform/environment/%/.apply: terraform/environment/%/tfplan
	cd terraform/environment/$* && \
	if [ -s tfplan ]; then \
		terraform apply -auto-approve tfplan || EXIT_CODE=$$?; \
	fi; \
	rm -f tfplan; \
	touch .apply; \
	exit $${EXIT_CODE:-0}

# Special targets for state infrastructure (has bootstrap script)
.PRECIOUS: terraform/environment/state/.terraform
terraform/environment/state/.terraform:
	@echo "Ensuring state infrastructure exists..."
	@terraform/scripts/ensure-state-bucket.sh
	@echo "Initializing Terraform for state infrastructure..."
	cd terraform/environment/state && \
	terraform init \
		-backend-config="bucket=$(STATE_BUCKET)" \
		-backend-config="key=$(PROJECT)/state/terraform.tfstate"

# Environment stamp files - depend on init and relevant modules
terraform/environment/state/.stamp: terraform/environment/state \
                                  terraform/environment/state/*.tf \
                                  terraform/module/state-infrastructure/*.tf
	@touch $@

terraform/environment/aws/.stamp: terraform/environment/aws \
                                terraform/environment/aws/*.tf \
                                terraform/module/oidc/*.tf \
                                terraform/module/iac-roles/*.tf
	@touch $@

terraform/environment/github/.stamp: terraform/environment/github \
                                terraform/environment/github/*.tf
	@touch $@

terraform/environment/test/.stamp: terraform/environment/test \
                                terraform/environment/test/*.tf \
                                terraform/module/dnd-planner/*.tf \
                                terraform/module/dnd-planner/openapi.yaml
	@touch $@

terraform/environment/prod/.stamp: terraform/environment/prod \
                                terraform/environment/prod/*.tf \
                                terraform/module/dnd-planner/*.tf \
                                terraform/module/dnd-planner/openapi.yaml
	@touch $@

# Combined setup target for any environment
setup-state: terraform/environment/state/.apply
setup-aws: terraform/environment/aws/.apply
setup-github: terraform/environment/github/.apply
deploy-test: validate-test test build go-build push-test
#deploy-prod: terraform/environment/prod/.apply # - this runs in a pipeline instead

# ============================================
# Frontend targets
# ============================================

# Pattern rule for building Lambda binaries
build/lambdas/%/bootstrap: backend/cmd/%/main.go
	@echo "Building $*..."
	@mkdir -p build/lambdas/$*
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "$@" "./backend/cmd/$*"

# Archives for Lambda functions
ARCHIVES := $(addprefix build/archives/,$(addsuffix .zip,$(LAMBDAS)))

# Create deterministic zip (fixed timestamp for reproducibility)
build/archives/%.zip: build/lambdas/%/bootstrap
	@echo "Archiving $*..."
	@mkdir -p build/archives
	@touch -t 198001010000 build/lambdas/$*/bootstrap
	cd build/lambdas/$* && zip -X -q ../../archives/$*.zip bootstrap

# Build all Lambda functions (binaries + zips)
go-build: $(LAMBDA_BINARIES) $(ARCHIVES)

# Pattern rule for deploying a single lambda to test
deploy-lambda-test-%: build/archives/%.zip
	@echo "Deploying $* to test..."
	aws lambda update-function-code \
		--function-name "dnd-planner-test-$*" \
		--zip-file "fileb://$(PWD)/$<" \
		--no-cli-pager

# Pattern rule for deploying a single lambda to prod
deploy-lambda-prod-%: build/archives/%.zip
	@echo "Deploying $* to prod..."
	aws lambda update-function-code \
		--function-name "dnd-planner-prod-$*" \
		--zip-file "fileb://$(PWD)/$<" \
		--no-cli-pager

# Deploy all lambdas to test
DEPLOY_LAMBDAS_TEST := $(addprefix deploy-lambda-test-,$(LAMBDAS))
deploy-lambdas-test: $(DEPLOY_LAMBDAS_TEST)

# Deploy all lambdas to prod
DEPLOY_LAMBDAS_PROD := $(addprefix deploy-lambda-prod-,$(LAMBDAS))
deploy-lambdas-prod: $(DEPLOY_LAMBDAS_PROD)

# Ensure pnpm is available
pnpm:
	@which pnpm > /dev/null || npm install -g pnpm

# Install dependencies
install: pnpm
	pnpm install

terraform/environment/test/output.json: terraform/environment/test/.apply
	cd terraform/environment/test && \
	terraform output -json > ../../../$@

.env.local: terraform/environment/test/output.json
	@echo "Generating .env.local from terraform outputs..."
	@echo "VITE_API_PROXY_TARGET=\"https://$$(jq -r '.cdn_nice_domain.value' $<)\"" > $@
	@echo "VITE_COGNITO_USER_POOL_ID=\"$$(jq -r '.cognito_user_pool_id.value' $<)\"" >> $@
	@echo "VITE_COGNITO_WEB_CLIENT_ID=\"$$(jq -r '.cognito_web_client_id.value' $<)\"" >> $@
	@echo "VITE_COGNITO_IDENTITY_POOL_ID=\"$$(jq -r '.cognito_identity_pool_id.value' $<)\"" >> $@
	@echo "VITE_COGNITO_LOGIN_DOMAIN=\"$$(jq -r '.cognito_login_domain.value' $<)\"" >> $@

setup-dev: .env.local

# Development server
dev: .env.local install
	pnpm dev

# Production build
build: install
	pnpm build

# Linting
lint: install
	pnpm lint

# Format
format: format-terraform format-frontend

format-frontend: install
	pnpm format

# Format check (for CI)
format-check: install
	pnpm format:check

# Unit tests (Vitest)
test-unit: install
	pnpm test

# E2E tests (Playwright) - CI friendly, no browser opening
test-e2e: build
	pnpm exec playwright test --reporter=list

# E2E tests with HTML report and browser viewing (for debugging)
test-e2e-debug: build
	pnpm test:e2e

# Component tests (Playwright)
test-component: install
	pnpm test:component

# Get terraform outputs for test environment
TEST_BUCKET := $(shell AWS_PROFILE=$(AWS_PROFILE) AWS_REGION=$(AWS_REGION) terraform -chdir=terraform/environment/test output -raw s3_bucket_name 2>/dev/null)
TEST_CDN_ID := $(shell AWS_PROFILE=$(AWS_PROFILE) AWS_REGION=$(AWS_REGION) terraform -chdir=terraform/environment/test output -raw cloudfront_distribution_id 2>/dev/null)

# Push to test environment (build and sync to S3)
push-test: terraform/environment/test/.apply build go-build deploy-lambdas-test
	@echo "Syncing to S3 bucket: $(TEST_BUCKET)"
	@aws s3 sync build/ s3://$(TEST_BUCKET)/ --delete
	@echo "Invalidating CloudFront distribution: $(TEST_CDN_ID)"
	@aws cloudfront create-invalidation --distribution-id $(TEST_CDN_ID) --paths "/*"

# Validate for any environment
validate-%: terraform/environment/%/.terraform
	cd terraform/environment/$* && terraform validate

# Validate all environments
validate: $(addprefix validate-,$(ENVS))

# Security scan
security:
	docker run --rm -v $(PWD)/terraform:/tf aquasec/trivy:latest config --severity CRITICAL,HIGH /tf

# Run all tests (terraform + frontend)
test: validate security test-unit test-e2e lint

preflight: format-terraform format test

# Format
format-terraform:
	terraform fmt -recursive

# Clean all generated files
clean:
	@echo "Cleaning Terraform artifacts..."
	rm -rf terraform/environment/*/.terraform
	rm -f terraform/environment/*/.terraform.lock.hcl
	rm -f terraform/environment/*/.stamp
	rm -f terraform/environment/*/tfplan
	rm -rf terraform/archives
	@echo "Cleaning Go artifacts..."
	rm -rf build/lambdas
	@echo "Cleaning frontend artifacts..."
	rm -rf build .svelte-kit node_modules coverage test-results playwright-report
	@echo "Done."

# Help
help:
	@echo "$(PROJECT) Makefile"
	@echo ""
	@echo "Infrastructure:"
	@echo "  make setup-state         Setup state infrastructure (init, plan, apply)"
	@echo "  make setup-aws           Setup AWS infrastructure (init, plan, apply)"
	@echo "  make setup-github        Setup GitHub infrastructure (init, plan, apply)"
	@echo "  make deploy-test         Deploy test environment (terraform + frontend)"
	@echo ""
	@echo "Frontend:"
	@echo "  make install             Install npm dependencies (pnpm auto-installs)"
	@echo "  make dev                 Start development server"
	@echo "  make build               Build for production"
	@echo "  make push-test           Build and sync to test S3 + invalidate CDN"
	@echo ""
	@echo "Testing:"
	@echo "  make test                Run all tests (terraform + frontend)"
	@echo "  make test-unit           Run Vitest unit tests"
	@echo "  make test-e2e            Run Playwright E2E tests (CI-friendly)"
	@echo "  make test-e2e-debug      Run Playwright E2E tests with debug report"
	@echo "  make test-component      Run Playwright component tests"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint                Run ESLint"
	@echo "  make format              Format code (terraform + frontend)"
	@echo ""
	@echo "Utility:"
	@echo "  make validate            Validate all terraform environments"
	@echo "  make security            Run Trivy security scan (CRITICAL, HIGH)"
	@echo "  make clean               Remove all generated artifacts"
