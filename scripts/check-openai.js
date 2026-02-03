#!/usr/bin/env node
const path = require('path')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

console.log('NODE_ENV:', process.env.NODE_ENV || 'undefined')
console.log('OPENAI_API_KEY set:', !!process.env.OPENAI_API_KEY)
console.log('OPENAI_MODEL:', process.env.OPENAI_MODEL || '(not set)')
