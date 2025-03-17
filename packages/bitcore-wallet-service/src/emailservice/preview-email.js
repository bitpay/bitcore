#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Mustache = require('mustache');
const os = require('os');
const { exec } = require('child_process');
const sgMail = require('@sendgrid/mail');

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
const IMG_DIR = path.join(TEMPLATE_DIR, 'icons');

// Email type configurations
const EMAIL_CONFIGS = {
  new_copayer: {
    icon: 'new_copayer.svg',
    iconAlt: 'New Copayer Icon'
  },
  wallet_complete: {
    icon: 'green_check.svg',
    iconAlt: 'Wallet Complete Icon'
  },
  new_tx_proposal: {
    icon: 'writing.svg',
    iconAlt: 'Transaction Proposal Icon'
  },
  new_outgoing_tx: {
    icon: 'up_arrow_gray.svg',
    iconAlt: 'Outgoing Transaction Icon'
  },
  new_zero_outgoing_tx: {
    icon: 'up_arrow_gray.svg',
    iconAlt: 'Outgoing Transaction Icon'
  },
  new_incoming_tx: {
    icon: 'down_arrow_green.svg',
    iconAlt: 'Incoming Transaction Icon'
  },
  new_incoming_tx_testnet: {
    icon: 'down_arrow_green.svg',
    iconAlt: 'Incoming Transaction Testnet Icon'
  },
  txp_finally_rejected: {
    icon: 'red_x.svg',
    iconAlt: 'Payment Proposal Rejected Icon'
  },
  tx_confirmation: {
    icon: 'green_check.svg',
    iconAlt: 'Transaction Confirmed Icon'
  },
  tx_confirmation_receiver: {
    icon: 'green_check.svg',
    iconAlt: 'Transaction Confirmed Icon'
  },
  tx_confirmation_sender: {
    icon: 'green_check.svg',
    iconAlt: 'Transaction Confirmed Icon'
  }
};

// Validate arguments
if (!templateName || !TEMPLATE_TYPES.includes(templateName)) {
  console.log('Usage: node preview-email.js <templateName> [language] [send] [recipientEmail]');
  console.log('  - templateName: Name of the template to preview');
  console.log('  - language: Language code (default: en)');
  console.log('  - send: Set to "send" to send an actual email');
  console.log('  - recipientEmail: Email address to send to (required if send=true)');
  console.log('\nAvailable templates:');
  TEMPLATE_TYPES.forEach(type => console.log(`- ${type}`));
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

  // Try to read the title from the plain text file
  try {
    const plainTextPath = path.join(TEMPLATE_DIR, language, `${templateName}.plain`);
    const plainContent = fs.readFileSync(plainTextPath, 'utf8');
    const firstLine = plainContent.split('\n')[0];
    if (firstLine && firstLine.startsWith('{{subjectPrefix}}')) {
      commonData.title = firstLine.replace('{{subjectPrefix}}', '');
    }
  } catch (err) {
    // Use default title if plain text file can't be read
  }

  // Add icon path
  const iconName = EMAIL_CONFIGS[templateName]?.icon || 'success-blue-icon.png';
  commonData.iconPath = path.join(IMG_DIR, iconName);

  // Template-specific data
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

// Read templates
const masterTemplate = fs.readFileSync(MASTER_TEMPLATE_PATH, 'utf8');
const contentTemplate = fs.existsSync(CONTENT_TEMPLATE_PATH) 
  ? fs.readFileSync(CONTENT_TEMPLATE_PATH, 'utf8')
  : createBasicHtmlFromPlain(templateName);

function createBasicHtmlFromPlain(templateName) {
  // Try to read the plain text version first
  const plainTextPath = path.join(TEMPLATE_DIR, language, `${templateName}.plain`);
  let plainContent = '';
  
  try {
    plainContent = fs.readFileSync(plainTextPath, 'utf8')
      .split('\n')
      .slice(2) // Skip the subject line and empty line
      .join('\n')
      .trim();
  } catch (err) {
    plainContent = `This is a sample email template for ${templateName}`;
  }

  return `
<div class="status-icon mb-1">
    <img src="icons/{{icon}}" alt="{{iconAlt}}" width="70">
</div>

<h1 class="mb-2">
    {{title}}
</h1>

<div class="divider"></div>

<div class="text-16">
    ${plainContent}
</div>`;
}

// Save HTML to temp file and open in browser
const previewInBrowser = (html) => {
  const tempDir = os.tmpdir();
  const previewDir = path.join(tempDir, `bitcore-email-preview-${Date.now()}`);
  const tempFilePath = path.join(previewDir, 'index.html');
  
  // Create temp directory structure
  fs.mkdirSync(previewDir);
  fs.mkdirSync(path.join(previewDir, 'icons'));
  
  // Copy icons
  fs.readdirSync(IMG_DIR).forEach(file => {
    const srcPath = path.join(IMG_DIR, file);
    const destPath = path.join(previewDir, 'icons', file);
    fs.copyFileSync(srcPath, destPath);
  });
  
  // Write HTML file
  fs.writeFileSync(tempFilePath, html, 'utf8');
  console.log(`Opening preview in browser: ${tempFilePath}`);

  // Open browser based on the operating system
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

  // Replace content placeholder with actual content
  const html = masterTemplate.replace('{{> htmlContent}}', contentTemplate);
  
  // Render final HTML with data
  const renderedHtml = Mustache.render(html, data);

  // Display subject
  console.log('\nSubject:', data.title);

  // Preview HTML in browser
  if (renderedHtml) {
    const tempFilePath = previewInBrowser(renderedHtml);
    console.log('HTML preview saved to:', tempFilePath);
  } else {
    console.error('Failed to generate HTML preview');
  }

  // Send actual email if requested
  if (sendEmail) {
    console.log(`\nSending test email to ${recipientEmail}...`);
    await sendTestEmail(
      data.title,
      data.buttonVars.text,
      renderedHtml,
      recipientEmail
    );
  }
};

// Run the preview
previewTemplate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 