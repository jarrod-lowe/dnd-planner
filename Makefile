.PHONY: fmt validate security test help clean

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
                                terraform/module/dnd-planner/*.tf
	@touch $@

terraform/environment/prod/.stamp: terraform/environment/prod \
                                terraform/environment/prod/*.tf \
                                terraform/module/dnd-planner/*.tf
	@touch $@

# Combined setup target for any environment
setup-state: terraform/environment/state/.apply
setup-aws: terraform/environment/aws/.apply
setup-github: terraform/environment/github/.apply
deploy-test: terraform/environment/test/.apply
#deploy-prod: terraform/environment/prod/.apply # - this runs in a pipeline instead

# Validate for any environment
validate-%:
	cd terraform/environment/$* && terraform validate

# Validate all environments
validate: $(addprefix validate-,$(ENVS))

# Security scan
security:
	docker run --rm -v $(PWD)/terraform:/tf aquasec/trivy:latest config --severity CRITICAL,HIGH /tf

# Run all tests
test: validate security

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
	@echo "Done."

# Help
help:
	@echo "$(PROJECT) Terraform Makefile"
	@echo ""
	@echo "Initial Setup:"
	@echo "  make setup-state         Setup state infrastructure (init, plan, apply)"
	@echo "  make setup-aws           Setup AWS infrastructure (init, plan, apply)"
	@echo "  make setup-github        Setup GitHub infrastructure (init, plan, apply)"
	@echo "  make deploy-test         Setup test environment (init, plan, apply)"
	@echo ""
	@echo "Utility:"
	@echo "  make fmt                 Format terraform files"
	@echo "  make validate            Validate all environments (test, prod)"
	@echo "  make security            Run Trivy security scan (CRITICAL, HIGH)"
	@echo "  make test                Run validate and security"
	@echo "  make clean               Remove generated Terraform artifacts"
