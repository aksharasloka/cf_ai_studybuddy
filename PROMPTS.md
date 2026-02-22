# AI Prompts Used in Development

This document contains all AI prompts used during the development of AI Study Buddy.

## Chat System Prompt

Used for the main chat functionality in src/index.js:

## Study Pack Generation Prompts

### Summary Generation Prompt

Used in src/studyPackWorkflow.js for creating study summaries:

### Flashcards Generation Prompt

Used for generating flashcards from study notes:
Return ONLY valid JSON. No markdown. No explanation. Use double quotes.

 
### Quiz Generation Prompt
 
Used for creating quiz questions from study notes:
 
Return ONLY valid JSON. No markdown. No explanation. Use double quotes.

 
## Model Configuration
 
### AI Model Used
- Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast
- Max tokens for chat: 700
- Max tokens for summary: 500
- Max tokens for flashcards: 900
- Max tokens for quiz: 1200
 
### Context Usage
 
For chat functionality, the system combines:
1. System prompt (StudyBuddy persona)
2. User's saved notes (if available)
3. Recent chat history (last 12 messages)
4. Current user message
 
## JSON Parsing Strategy
 
For flashcards and quiz generation, implemented robust JSON parsing:
- Handles markdown code blocks
- Fixes smart quotes and trailing commas
- Extracts JSON from mixed content
- Falls back gracefully if parsing fails
 
## Development Notes
 
- All prompts designed to be concise and clear
- JSON-only prompts reduce model hallucination
- System prompt establishes helpful tutor persona
- Context awareness improves relevance of responses
Feedback submitt