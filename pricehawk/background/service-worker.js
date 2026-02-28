/**
 * PriceHawk — Background Service Worker
 * Manages tracked products, price checks, and alerts
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('ph_products', (data) => {
    if (!data.ph_products) chrome.storage.local.set({ ph_products: [] });
  });
  // Check prices every 6 hours
  chrome.alarms.create('priceCheck', { periodInMinutes: 360 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'priceCheck') {
    // Price check would require content script injection — simplified for local tracking
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const data = await getStorage('ph_products');
    let products = data.ph_products || [];

    switch (message.type) {
      case 'ADD_PRODUCT': {
        const product = {
          id: genId(),
          name: message.name,
          url: message.url,
          domain: extractDomain(message.url),
          targetPrice: message.targetPrice || null,
          priceHistory: message.currentPrice ? [{ price: message.currentPrice, date: todayKey(), timestamp: Date.now() }] : [],
          addedAt: Date.now(),
          currency: message.currency || '₹',
          notes: message.notes || ''
        };
        products.unshift(product);
        await setStorage({ ph_products: products });
        sendResponse({ success: true, product });
        break;
      }

      case 'UPDATE_PRICE': {
        const idx = products.findIndex(p => p.id === message.id);
        if (idx >= 0) {
          const currentPrice = message.price;
          products[idx].priceHistory.push({
            price: currentPrice,
            date: todayKey(),
            timestamp: Date.now()
          });

          // Check for price drop alert
          if (products[idx].targetPrice && currentPrice <= products[idx].targetPrice) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: '💰 Price Drop Alert!',
              message: `${products[idx].name} dropped to ${products[idx].currency}${currentPrice}!`
            });
          }

          await setStorage({ ph_products: products });
          sendResponse({ success: true });
        }
        break;
      }

      case 'GET_PRODUCTS': {
        sendResponse({ products });
        break;
      }

      case 'DELETE_PRODUCT': {
        products = products.filter(p => p.id !== message.id);
        await setStorage({ ph_products: products });
        sendResponse({ success: true });
        break;
      }

      case 'ANALYZE_DEAL': {
        const product = products.find(p => p.id === message.id);
        if (!product || product.priceHistory.length < 2) {
          sendResponse({ success: false, text: 'Need more price history data to analyze.' });
          break;
        }

        const prices = product.priceHistory.map(h => h.price);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const current = prices[prices.length - 1];

        try {
          const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama3.2',
              prompt: `Analyze this product deal and tell me if it's a good time to buy.\n\nProduct: ${product.name}\nCurrent Price: ${product.currency}${current}\nAverage Price: ${product.currency}${avg.toFixed(2)}\nLowest: ${product.currency}${min}\nHighest: ${product.currency}${max}\nPrice History (last ${prices.length} records): ${prices.join(', ')}\n\nRespond in 3-4 sentences. Is this a good deal? Is it likely a fake sale?`,
              stream: false,
              options: { temperature: 0.4, num_predict: 300 }
            })
          });
          const result = await response.json();
          sendResponse({ success: true, text: result.response });
        } catch (err) {
          sendResponse({ success: false, text: 'Ollama not available. Start with: ollama serve' });
        }
        break;
      }

      case 'GET_STATS': {
        const totalProducts = products.length;
        const totalSavings = products.reduce((sum, p) => {
          if (p.priceHistory.length < 2) return sum;
          const prices = p.priceHistory.map(h => h.price);
          const max = Math.max(...prices);
          const current = prices[prices.length - 1];
          return sum + Math.max(0, max - current);
        }, 0);

        const domainCounts = {};
        products.forEach(p => { domainCounts[p.domain] = (domainCounts[p.domain] || 0) + 1; });

        sendResponse({ totalProducts, totalSavings, domainCounts });
        break;
      }

      default:
        sendResponse({ error: 'Unknown' });
    }
  })();
  return true;
});

function getStorage(k) { return new Promise(r => chrome.storage.local.get(k, r)); }
function setStorage(d) { return new Promise(r => chrome.storage.local.set(d, r)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }
function extractDomain(url) { try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; } }
function todayKey() { return new Date().toISOString().split('T')[0]; }
