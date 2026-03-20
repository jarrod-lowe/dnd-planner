# The _shared directory is for Terraform code that is shared across multiple
# environments. Because it is not a complete module, linters may not be able to
# resolve references, so we create some dummy values to make the linters happy.
# These values are not used in any actual Terraform runs, so they can be safely ignored.
locals {
  environment = "none"
}
