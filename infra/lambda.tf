data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/../backend/dist/handler.mjs"
  output_path = "${path.module}/../backend/dist/hami-backend.zip"
}

resource "aws_lambda_function" "chat" {
  function_name = "${local.name}-chat"
  role          = aws_iam_role.lambda.arn
  runtime       = "nodejs22.x"
  handler       = "handler.handler"
  filename      = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  architectures = ["arm64"]
  memory_size   = 256
  timeout       = 28
  reserved_concurrent_executions = var.lambda_reserved_concurrency

  environment {
    variables = local.common_environment
  }

  depends_on = [aws_iam_role_policy.lambda]
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chat.execution_arn}/*/*"
}
