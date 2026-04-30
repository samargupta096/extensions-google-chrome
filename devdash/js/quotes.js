const quotes = [
  { text: "It works on my machine.", author: "Every Developer" },
  { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
  { text: "Programs must be written for people to read, and only incidentally for machines to execute.", author: "Harold Abelson" },
  { text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", author: "Martin Fowler" },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
  { text: "Experience is the name everyone gives to their mistakes.", author: "Oscar Wilde" },
  { text: "In order to be irreplaceable, one must always be different.", author: "Coco Chanel" },
  { text: "Java is to JavaScript what car is to Carpet.", author: "Chris Heilmann" },
  { text: "Sometimes it pays to stay in bed on Monday, rather than spending the rest of the week debugging Monday's code.", author: "Dan Salomon" },
  { text: "Fix the cause, not the symptom.", author: "Steve Maguire" }
];

let customQuote = null;

function displayQuote(quote) {
  const quoteText = document.getElementById('quote-text');
  const quoteAuthor = document.getElementById('quote-author');
  if (quoteText && quoteAuthor) {
    quoteText.textContent = `"${quote.text}"`;
    quoteAuthor.textContent = `- ${quote.author}`;
  }
}

function setRandomQuote() {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  displayQuote(quotes[randomIndex]);
}

document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refresh-quote-btn');
  const settingsBtn = document.getElementById('quote-settings-btn');
  const saveBtn = document.getElementById('save-custom-quote-btn');
  const clearBtn = document.getElementById('clear-custom-quote-btn');
  const displayView = document.getElementById('quote-display-view');
  const editView = document.getElementById('quote-edit-view');
  const quoteInput = document.getElementById('custom-quote-input');
  const authorInput = document.getElementById('custom-author-input');

  // Load custom quote
  chrome.storage.local.get(['customQuote'], (res) => {
    if (res.customQuote) {
      customQuote = res.customQuote;
      displayQuote(customQuote);
      quoteInput.value = customQuote.text;
      authorInput.value = customQuote.author;
    } else {
      setRandomQuote();
    }
  });

  refreshBtn && refreshBtn.addEventListener('click', () => {
    customQuote = null;
    chrome.storage.local.remove('customQuote');
    setRandomQuote();
  });

  settingsBtn && settingsBtn.addEventListener('click', () => {
    displayView.classList.toggle('active');
    editView.classList.toggle('active');
  });

  saveBtn && saveBtn.addEventListener('click', () => {
    const text = quoteInput.value.trim();
    const author = authorInput.value.trim() || 'Anonymous';
    
    if (text) {
      customQuote = { text, author };
      chrome.storage.local.set({ customQuote });
      displayQuote(customQuote);
      displayView.classList.add('active');
      editView.classList.remove('active');
    }
  });

  clearBtn && clearBtn.addEventListener('click', () => {
    quoteInput.value = '';
    authorInput.value = '';
    customQuote = null;
    chrome.storage.local.remove('customQuote');
    setRandomQuote();
    displayView.classList.add('active');
    editView.classList.remove('active');
  });
});
