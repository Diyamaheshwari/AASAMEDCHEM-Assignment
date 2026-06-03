const fs = require('fs');
const path = require('path');

const source = 'C:\\Users\\laksh\\.gemini\\antigravity\\brain\\a0c9d81f-895a-4ea0-8aca-a7bf9d62118f\\lab_illustration_1780463427174.png';
const target = path.join(__dirname, '..', '..', 'public', 'lab_illustration.png');

try {
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, target);
    console.log('Image copied successfully to:', target);
  } else {
    console.error('Source image does not exist:', source);
  }
} catch (error) {
  console.error('Failed to copy image:', error);
}
