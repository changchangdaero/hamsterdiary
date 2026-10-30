resource "aws_iam_role" "lambda" {
  name = "${local.name}-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "${local.name}-lambda-minimum"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "UsageTable"
        Effect   = "Allow"
        Action   = ["dynamodb:BatchGetItem", "dynamodb:DeleteItem", "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:TransactWriteItems", "dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.usage.arn
      },
      {
        Sid    = "ReadOnlyRequiredSecrets"
        Effect = "Allow"
        Action = "ssm:GetParameter"
        Resource = [
          aws_ssm_parameter.ai_api_key.arn,
          aws_ssm_parameter.installation_hash_secret.arn
        ]
      },
      {
        Sid      = "WriteFunctionLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.lambda.arn}:*"
      },
      {
        Sid      = "PublishAiCostMetric"
        Effect   = "Allow"
        Action   = "cloudwatch:PutMetricData"
        Resource = "*"
        Condition = {
          StringEquals = { "cloudwatch:namespace" = "Hami/AI" }
        }
      }
    ]
  })
}
