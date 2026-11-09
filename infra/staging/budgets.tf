# AWS Monthly Cost Budget with 25 / 40 / 50 USD threshold alerts
resource "aws_budgets_budget" "monthly" {
  name         = "${var.project_name}-${var.environment}-monthly-budget"
  budget_type  = "COST"
  limit_amount = tostring(var.budget_limit_usd) # 50 USD
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Alert 1: 25 USD (50% of budget)
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50 # 50% = $25 USD
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.alert_emails
  }

  # Alert 2: 40 USD (80% of budget)
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80 # 80% = $40 USD
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.alert_emails
  }

  # Alert 3: 50 USD (100% of budget)
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100 # 100% = $50 USD
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.alert_emails
  }

  cost_types {
    include_credit             = false
    include_discount           = true
    include_other_subscription = true
    include_recurring          = true
    include_refund             = false
    include_subscription       = true
    include_support            = true
    include_tax                = true
    include_upfront            = true
    use_blended                = false
  }
}
