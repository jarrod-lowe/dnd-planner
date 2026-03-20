.PHONY: fmt validate security test help clean dev build lint format test-unit test-e2e test-component format-check push-test install pnpm

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
deploy-test: validate-test test build push-test
#deploy-prod: terraform/environment/prod/.apply # - this runs in a pipeline instead

# ============================================
# Frontend targets
# ============================================

# Ensure pnpm is available
pnpm:
	@which pnpm > /dev/null || npm install -g pnpm

# Install dependencies
install: pnpm
	pnpm install

# Development server
dev: install
	pnpm dev

# Production build
build: install
	pnpm build

# Linting
lint: install
	pnpm lint

# Format
format: install
	pnpm format

# Format check (for CI)
format-check: install
	pnpm format:check

# Unit tests (Vitest)
test-unit: install
	pnpm test

# E2E tests (Playwright)
test-e2e: build
	pnpm test:e2e

# Component tests (Playwright)
test-component: install
	pnpm test:component

# Get terraform outputs for test environment
TEST_BUCKET := $(shell AWS_PROFILE=$(AWS_PROFILE) AWS_REGION=$(AWS_REGION) terraform -chdir=terraform/environment/test output -raw s3_bucket_name 2>/dev/null)
TEST_CDN_ID := $(shell AWS_PROFILE=$(AWS_PROFILE) AWS_REGION=$(AWS_REGION) terraform -chdir=terraform/environment/test output -raw cloudfront_distribution_id 2>/dev/null)

# Push to test environment (build and sync to S3)
push-test: build
	@echo "Syncing to S3 bucket: $(TEST_BUCKET)"
	@aws s3 sync build/ s3://$(TEST_BUCKET)/ --delete
	@echo "Invalidating CloudFront distribution: $(TEST_CDN_ID)"
	@aws cloudfront create-invalidation --distribution-id $(TEST_CDN_ID) --paths "/*"

# Validate for any environment
validate-%:
	cd terraform/environment/$* && terraform validate

# Validate all environments
validate: $(addprefix validate-,$(ENVS))

# Security scan
security:
	docker run --rm -v $(PWD)/terraform:/tf aquasec/trivy:latest config --severity CRITICAL,HIGH /tf

# Run all tests (terraform + frontend)
test: validate security test-unit test-e2e lint

preflight: fmt format test

# Format
fmt:
	terraform fmt -recursive

# Clean all generated files
clean:
	@echo "Cleaning Terraform artifacts..."
	rm -rf terraform/environment/*/.terraform
	rm -f terraform/environment/*/.terraform.lock.hcl
	rm -f terraform/environment/*/.stamp
	rm -f terraform/environment/*/tfplan
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
	@echo "  make test-e2e            Run Playwright E2E tests"
	@echo "  make test-component      Run Playwright component tests"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint                Run ESLint"
	@echo "  make format              Format code with Prettier"
	@echo "  make fmt                 Format terraform files"
	@echo ""
	@echo "Utility:"
	@echo "  make validate            Validate all terraform environments"
	@echo "  make security            Run Trivy security scan (CRITICAL, HIGH)"
	@echo "  make clean               Remove all generated artifacts"
