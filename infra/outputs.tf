output "chat_api_url" {
  description = "Hami desktop chat endpoint"
  value       = "${aws_apigatewayv2_api.chat.api_endpoint}/v1/chat"
}

output "ai_api_key_parameter_name" {
  value = var.ai_api_key_parameter_name
}

output "hash_secret_parameter_name" {
  value = var.hash_secret_parameter_name
}
