# AI Study Buddy

A smart study assistant that helps you learn better with AI. Think of it as having a patient tutor available 24/7 who remembers your notes and helps you prepare for exams.

## What It Does

- Chat with AI about your study material
- Save and organize your notes
- Automatically create study summaries, flashcards, and quizzes
- Remembers your conversations and notes
- Works instantly from anywhere

## Quick Start

1. Install dependencies: `npm install`
2. Login to Cloudflare: `wrangler login`
3. Run locally: `npm run dev`
4. Deploy: `npm run deploy`

## How to Use

### Save Notes
```bash
curl -X POST http://localhost:8787/notes \
  -H "Content-Type: application/json" \
  -d '{"notes": "Your study notes here", "userId": "your-name"}'

### Chat with AI

curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Explain photosynthesis simply", "userId": "your-name"}'

### Create Study Pack
curl -X POST http://localhost:8787/study-pack \
  -H "Content-Type: application/json" \
  -d '{"userId": "your-name"}'

