const fs = require('fs');
const path = require('path');
const { generatePDF } = require('../output/pdfGenerator');

describe('pdfGenerator', () => {
  const sessionDir = path.join(__dirname, 'test-session-pdf');
  const resultsPdfPath = path.join(sessionDir, 'results.pdf');

  beforeAll(() => {
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    // Create dummy screenshots
    const screenshotsDir = path.join(sessionDir, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(screenshotsDir, 'inv1_site1.png'), 'dummy');
    fs.writeFileSync(path.join(screenshotsDir, 'inv1_site2.png'), 'dummy');
  });

  afterAll(() => {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  });

  it('should generate a results.pdf file', async () => {
    const invoices = [
      {
        id: 'inv1',
        sellerName: 'Test Seller',
        taxId: '123456789',
        address: '123 Test St',
        totalAmount: 1000000,
        status: 'completed',
        screenshots: {
          site1: 'screenshots/inv1_site1.png',
          site2: 'screenshots/inv1_site2.png'
        }
      }
    ];

    await generatePDF(sessionDir, invoices);
    expect(fs.existsSync(resultsPdfPath)).toBe(true);
  });
});
