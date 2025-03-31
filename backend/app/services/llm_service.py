import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential
from datetime import datetime
from typing import Dict, Any
import logging
import os
from ..models.schemas import LLMConfig

logger = logging.getLogger(__name__)

class EnhancedLLMWrapper:
    def __init__(self, config: LLMConfig):
        self.config = config
        self.session = aiohttp.ClientSession()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.session.close()
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True
    )
    async def _make_api_call(self, prompt: str) -> Dict[str, Any]:
        try:
            # print(f"Making API call with prompt length: {len(prompt)}") # Removed debug print
            
            # Longer timeout to handle potential delays
            timeout = self.config.timeout_seconds or 60
            
            # Check if we're using Gemini or OpenAI
            if "gemini" in self.config.model_name:
                return await self._make_gemini_api_call(prompt, timeout)
            else:
                return await self._make_openai_api_call(prompt, timeout)
                
        except aiohttp.ClientError as e:
            logger.error(f"Network error making API call: {str(e)}")
            raise Exception(f"Network error: {str(e)}")
        except Exception as e:
            logger.error(f"Error making API call: {str(e)}")
            raise
            
    async def _make_gemini_api_call(self, prompt: str, timeout: int) -> Dict[str, Any]:
        # Gemini API endpoint
        api_key = os.getenv("GEMINI_API_KEY")
        # print(f"Using Gemini API, key exists: {bool(api_key)}") # Removed debug print
        
        # Format model name - ensure it has 'models/' prefix
        model_name = self.config.model_name
        if not model_name.startswith("models/"):
            model_name = f"models/{model_name}"
            
        api_url = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent?key={api_key}"
        # print(f"Connecting to Gemini API: {api_url}") # Removed debug print (URL contains API key)
        
        # Gemini API payload format
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 8192, # Increased token limit
            }
        }
        
        async with self.session.post(
            api_url,
            json=payload,
            timeout=timeout
        ) as response:
            status_code = response.status
            # print(f"Gemini API response status code: {status_code}") # Removed debug print
            
            if status_code != 200:
                error_text = await response.text()
                logger.error(f"Gemini API call failed with status {status_code}: {error_text}")
                raise Exception(f"Gemini API call failed: {error_text}")
            
            response_data = await response.json()
            # print("Successfully received response from Gemini API") # Removed debug print
            
            # Transform Gemini response to the format expected by the application
            if 'candidates' in response_data and len(response_data['candidates']) > 0:
                content = ""
                for part in response_data['candidates'][0]['content']['parts']:
                    if 'text' in part:
                        content += part['text']
                
                transformed_response = {
                    "choices": [
                        {
                            "message": {
                                "content": content
                            }
                        }
                    ]
                }
                return transformed_response
            else:
                raise Exception("Gemini API returned an unexpected response format")
    
    async def _make_openai_api_call(self, prompt: str, timeout: int) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json"
        }
        
        api_url = "https://api.openai.com/v1/chat/completions"
        # print(f"Connecting to OpenAI API: {api_url}") # Removed debug print
        
        payload = {
            "model": self.config.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7
        }
        # print(f"Using OpenAI model: {self.config.model_name}") # Removed debug print
        
        async with self.session.post(
            api_url,
            headers=headers,
            json=payload,
            timeout=timeout
        ) as response:
            status_code = response.status
            # print(f"OpenAI API response status code: {status_code}") # Removed debug print
            
            if status_code != 200:
                error_text = await response.text()
                logger.error(f"OpenAI API call failed with status {status_code}: {error_text}")
                raise Exception(f"OpenAI API call failed: {error_text}")
            
            response_data = await response.json()
            # print("Successfully received response from OpenAI API") # Removed debug print
            return response_data