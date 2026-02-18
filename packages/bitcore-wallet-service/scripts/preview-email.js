#!/usr/bin/env node

import 'ts-node/esm';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sgMail from '@sendgrid/mail';
import juice from 'juice';
import Mustache from 'mustache';
import config from '../src/config';


const iconMap = {
  new_copayer: 'person-plus.png',
  new_incoming_tx: 'down-arrow-green.png',
  new_incoming_tx_testnet: 'down-arrow-green.png',
  new_outgoing_tx: 'up-arrow-gray.png',
  new_tx_proposal: 'writing-gray.png',
  new_zero_outgoing_tx: 'up-arrow-gray.png',
  tx_confirmation: 'green-check.png',
  tx_confirmation_receiver: 'green-check.png',
  tx_confirmation_sender: 'green-check.png',
  txp_finally_rejected: 'failed-icon.png',
  wallet_complete: 'green-check.png'
};

function getIconHtml (templateName) {
  const iconFile = iconMap[templateName];
  if (!iconFile) {
    return null;
  }

  const staticUrl = config.baseUrl || 'https://bws.bitpay.com';
  const iconUrl = `${staticUrl}/bws/static/images/${iconFile}`;
  
  return `<img src="${iconUrl}" alt="${templateName} icon" style="width: 50px; height: 50px;" />`;
}; 

// Parse command line arguments
const args = process.argv.slice(2);
const templateName = args[0] || 'new_copayer';
const language = args[1] || 'en';
const sendEmail = args[2] === 'send';
const recipientEmail = args[3]; // Required if sendEmail is true

// Available email templates
const TEMPLATE_TYPES = [
  'new_copayer',
  'wallet_complete',
  'new_tx_proposal',
  'new_outgoing_tx',
  'new_incoming_tx',
  'new_incoming_tx_testnet',
  'new_zero_outgoing_tx',
  'txp_finally_rejected',
  'tx_confirmation',
  'tx_confirmation_receiver',
  'tx_confirmation_sender'
];

// Template directory
const TEMPLATE_DIR = path.join(__dirname, '../../templates');
const MASTER_TEMPLATE_PATH = path.join(TEMPLATE_DIR, 'master-template.html');
const CONTENT_TEMPLATE_PATH = path.join(TEMPLATE_DIR, language, `${templateName}.html`);

console.log('Template directories:');
console.log('TEMPLATE_DIR:', TEMPLATE_DIR);

// Validate arguments
if (!templateName || !TEMPLATE_TYPES.includes(templateName)) {
  console.log('Usage: node preview-email.js <templateName> [language] [send] [recipientEmail]');
  console.log('  - templateName: Name of the template to preview');
  console.log('  - language: Language code (default: en)');
  console.log('  - send: Set to "send" to send an actual email');
  console.log('  - recipientEmail: Email address to send to (required if send=true)');
  console.log('\nAvailable templates:');
  for (const type of TEMPLATE_TYPES) {
    console.log(`- ${type}`);
  }
  process.exit(1);
}

if (sendEmail && !recipientEmail) {
  console.error('Error: Recipient email is required when sending an actual email');
  process.exit(1);
}

// Create sample data based on template type
const createSampleData = (templateName) => {
  // Common data for all templates
  const commonData = {
    title: templateName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    subjectPrefix: '[Wallet Service] ',
    walletId: 'testWalletId',
    walletName: 'Test Wallet',
    walletM: 2,
    walletN: 3,
    copayerId: 'testCopayerId',
    copayerName: 'John Doe'
  };

  const iconObj = getIconHtml(templateName, sendEmail);
  if (iconObj) {
    commonData.icon = iconObj;
  }

  try {
    const plainTextPath = path.join(TEMPLATE_DIR, language, `${templateName}.plain`);
    const plainContent = fs.readFileSync(plainTextPath, 'utf8');
    const firstLine = plainContent.split('\n')[0];
    if (firstLine && firstLine.startsWith('{{subjectPrefix}}')) {
      commonData.title = firstLine.replace('{{subjectPrefix}}', '');
    }
  } catch { /* ignore error */ }

  switch (templateName) {
    case 'new_copayer':
      return commonData;
    case 'wallet_complete': {
      const title = commonData.title;
      return {
        ...commonData,
        title: title || 'Wallet Complete'
      };
    }
    case 'new_tx_proposal': {
      const title = commonData.title;
      return {
        ...commonData,
        title: title || 'New Payment Proposal',
        txProposalId: 'txp-123',
        amount: '1.5 BTC',
        toAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        creatorName: 'John Doe'
      };
    }
    case 'new_outgoing_tx':
    case 'new_incoming_tx': {
      const title = commonData.title;
      return {
        ...commonData,
        title: title || (templateName === 'new_outgoing_tx' ? 'Payment Sent' : 'New Payment Received'),
        txid: '1234567890abcdef',
        amount: '1.5 BTC',
        address: {
          coin: 'btc'
        },
        urlForTx: 'https://explorer.bitpay.com/tx/1234567890abcdef'
      };
    }
    case 'new_incoming_tx_testnet': {
      const title = commonData.title;
      return {
        ...commonData,
        title: title || 'New Payment Received',
        txid: '1234567890abcdef',
        amount: '1.5 BTC',
        address: {
          coin: 'btc'
        },
        networkStr: ' en TESTNET',
        urlForTx: 'https://explorer.bitpay.com/tx/1234567890abcdef'
      };
    }
    case 'new_zero_outgoing_tx': {
      const title = commonData.title;
      return {
        ...commonData,
        title: title || 'Payment Sent',
        txid: '1234567890abcdef',
        urlForTx: 'https://explorer.bitpay.com/tx/1234567890abcdef'
      };
    }
    case 'txp_finally_rejected': {
      const title = commonData.title;
      return {
        ...commonData,
        title: title || 'Payment Proposal Rejected',
        txProposalId: 'txp-123',
        rejectorsNames: 'Jane Smith, Bob Johnson'
      };
    }
    case 'tx_confirmation': {
      const title = commonData.title;
      return {
        ...commonData,
        title: title || 'Transaction Confirmed',
        txid: '1234567890abcdef',
        amount: '1.5 BTC',
        urlForTx: 'https://explorer.bitpay.com/tx/1234567890abcdef'
      };
    }
    case 'tx_confirmation_receiver': {
      const title = commonData.title;
      return {
        ...commonData,
        title: title || 'Transaction Confirmed',
        txid: '1234567890abcdef',
        amount: '1.5 BTC',
        urlForTx: 'https://explorer.bitpay.com/tx/1234567890abcdef'
      };
    }
    case 'tx_confirmation_sender': {
      const title = commonData.title;
      return {
        ...commonData,
        title: title || 'Transaction Confirmed',
        txid: '1234567890abcdef',
        amount: '1.5 BTC',
        urlForTx: 'https://explorer.bitpay.com/tx/1234567890abcdef'
      };
    }
    default:
      return commonData;
  }
};

const masterTemplate = fs.readFileSync(MASTER_TEMPLATE_PATH, 'utf8');

function createBasicHtmlFromPlain(templateName) {
  const plainTextPath = path.join(TEMPLATE_DIR, language, `${templateName}.plain`);
  let plainContent = '';
  
  try {
    plainContent = fs.readFileSync(plainTextPath, 'utf8')
      .split('\n')
      .slice(2) // Skip the subject line and empty line
      .join('\n')
      .trim();
  } catch {
    plainContent = `This is a sample email template for ${templateName}`;
  }

  return `
    <h1 class="mb-2">{{title}}</h1>
    <div class="divider"></div>
    <div class="text-16">
      ${plainContent}
    </div>
  `;
}

// Save HTML to temp file and open in browser
const previewInBrowser = (html) => {
  const tempDir = os.tmpdir();
  const previewDir = path.join(tempDir, `bitcore-email-preview-${Date.now()}`);
  const tempFilePath = path.join(previewDir, 'index.html');
  
  fs.mkdirSync(previewDir);
  fs.writeFileSync(tempFilePath, html, 'utf8');
  console.log(`Opening preview in browser: ${tempFilePath}`);

  const platform = process.platform;
  try {
    if (platform === 'darwin') { // macOS
      exec(`open "${tempFilePath}"`);
    } else if (platform === 'win32') { // Windows
      exec(`start "" "${tempFilePath}"`);
    } else { // Linux and others
      exec(`xdg-open "${tempFilePath}"`);
    }
    console.log('Preview opened in your default browser');
  } catch (err) {
    console.error('Failed to open browser automatically:', err);
    console.log('Please open the HTML file manually at:', tempFilePath);
  }

  return tempFilePath;
};

// Send actual email
const sendTestEmail = async (subject, plainBody, htmlBody, recipient) => {
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  if (!SENDGRID_API_KEY) {
    console.error('Error: SENDGRID_API_KEY environment variable is required to send emails');
    process.exit(1);
  }

  sgMail.setApiKey(SENDGRID_API_KEY);

  const msg = {
    to: recipient,
    from: process.env.FROM_EMAIL || 'noreply@example.com',
    subject: subject,
    text: plainBody,
    html: htmlBody
  };

  try {
    await sgMail.send(msg);
    console.log(`Email successfully sent to ${recipient}`);
  } catch (error) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error(error.response.body);
    }
  }
};

// Main function
const previewTemplate = async () => {
  console.log(`Testing template: ${templateName} (${language})`);

  // Create sample data
  const data = createSampleData(templateName);

  // Read template
  const contentTemplate = fs.existsSync(CONTENT_TEMPLATE_PATH) 
    ? fs.readFileSync(CONTENT_TEMPLATE_PATH, 'utf8')
    : createBasicHtmlFromPlain(templateName);

  // Replace content placeholder with actual content
  const html = masterTemplate.replace('{{> htmlContent}}', contentTemplate);
  
  // Render final HTML with data
  const renderedHtml = Mustache.render(html, data);
  
  // Inline CSS for both preview and email
  const inlinedHtml = juice(renderedHtml, {
    removeStyleTags: false,
    preserveImportant: true,
    preserveMediaQueries: true,
    preserveFontFaces: true,
    applyStyleTags: true
  });

  // Display subject
  console.log('\nSubject:', data.title);

  // Preview HTML in browser
  if (inlinedHtml) {
    const tempFilePath = previewInBrowser(inlinedHtml);
    console.log('HTML preview saved to:', tempFilePath);
  } else {
    console.error('Failed to generate HTML preview');
  }

  // Send actual email if requested
  if (sendEmail) {
    console.log(`\nSending test email to ${recipientEmail}...`);
    
    // Generate plain text version
    const plainText = `${data.title}\n\nA new copayer just joined your wallet.`;
    
    await sendTestEmail(
      data.title,
      plainText,
      inlinedHtml,
      recipientEmail
    );
  }
};

// Run the preview
previewTemplate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 