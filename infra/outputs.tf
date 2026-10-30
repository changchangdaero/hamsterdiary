output "chat_api_url" {
  description = "Hami desktop chat endpoint"
  value       = "${aws_apigatewayv2_api.chat.api_endpoint}/v1/chat"
}

# The app derives this from chat_api_url; listed here for manual checks.
output "usage_api_url" {
  description = "Hami remaining-chat lookup endpoint"
  value       = "${aws_apigatewayv2_api.chat.api_endpoint}/v1/usage"
}

output "ai_api_key_parameter_name" {
  value = var.ai_api_key_parameter_name
}

output "hash_secret_parameter_name" {
  value = var.hash_secret_parameter_name
}
