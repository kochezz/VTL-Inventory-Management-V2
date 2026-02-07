// =====================================================
// VILAGIO BARCODE GENERATION UTILITIES
// File: barcodeUtils.ts
// Location: frontend/utils/barcodeUtils.ts
// Purpose: Generate and display barcodes (Code 128 & QR)
// =====================================================

import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

/**
 * Generate Code 128 barcode as Data URL
 * @param value - The barcode value (e.g., "WB-500-001")
 * @param options - Barcode display options
 * @returns Promise<string> - Data URL of barcode image
 */
export async function generateCode128Barcode(
  value: string,
  options: {
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    margin?: number;
  } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Create a temporary canvas
      const canvas = document.createElement('canvas');
      
      // Generate barcode
      JsBarcode(canvas, value, {
        format: 'CODE128',
        width: options.width || 2,
        height: options.height || 50,
        displayValue: options.displayValue !== false,
        fontSize: options.fontSize || 14,
        margin: options.margin || 10,
        background: '#ffffff',
        lineColor: '#000000'
      });
      
      // Convert to Data URL
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate QR Code as Data URL
 * @param value - The QR code data (can be JSON string)
 * @param options - QR code display options
 * @returns Promise<string> - Data URL of QR code image
 */
export async function generateQRCode(
  value: string,
  options: {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  } = {}
): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(value, {
      width: options.width || 200,
      margin: options.margin || 2,
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    return dataUrl;
  } catch (error) {
    throw error;
  }
}

/**
 * Generate QR Code with embedded product data (for future use)
 * @param productData - Product information to encode
 * @returns Promise<string> - Data URL of QR code
 */
export async function generateProductQRCode(productData: {
  productId: string;
  sku: string;
  productName: string;
  batchNumber?: string;
  lotNumber?: string;
  expiryDate?: string;
  manufacturingDate?: string;
}): Promise<string> {
  // Create compact JSON payload
  const payload = JSON.stringify({
    type: 'VILAGIO_PRODUCT',
    v: 1, // version
    id: productData.productId,
    sku: productData.sku,
    name: productData.productName,
    ...(productData.batchNumber && { batch: productData.batchNumber }),
    ...(productData.lotNumber && { lot: productData.lotNumber }),
    ...(productData.expiryDate && { exp: productData.expiryDate }),
    ...(productData.manufacturingDate && { mfg: productData.manufacturingDate })
  });
  
  return generateQRCode(payload, { 
    width: 250,
    errorCorrectionLevel: 'H' // Higher error correction for complex data
  });
}

/**
 * Generate location QR Code with embedded data
 * @param locationData - Location information to encode
 * @returns Promise<string> - Data URL of QR code
 */
export async function generateLocationQRCode(locationData: {
  locationId: string;
  locationCode: string;
  locationName: string;
  locationBarcode: string;
}): Promise<string> {
  const payload = JSON.stringify({
    type: 'VILAGIO_LOCATION',
    v: 1,
    id: locationData.locationId,
    code: locationData.locationCode,
    name: locationData.locationName,
    barcode: locationData.locationBarcode
  });
  
  return generateQRCode(payload, { width: 200 });
}

/**
 * Render Code 128 barcode directly to a canvas element
 * @param canvasElement - HTML Canvas element
 * @param value - Barcode value
 * @param options - Display options
 */
export function renderCode128ToCanvas(
  canvasElement: HTMLCanvasElement,
  value: string,
  options: {
    width?: number;
    height?: number;
    displayValue?: boolean;
  } = {}
): void {
  JsBarcode(canvasElement, value, {
    format: 'CODE128',
    width: options.width || 2,
    height: options.height || 50,
    displayValue: options.displayValue !== false,
    margin: 10
  });
}

/**
 * Download barcode as PNG file
 * @param dataUrl - Data URL of barcode image
 * @param filename - Name of file to download
 */
export function downloadBarcode(dataUrl: string, filename: string = 'barcode.png'): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Print barcode
 * @param dataUrl - Data URL of barcode image
 * @param productName - Optional product name to display
 */
export function printBarcode(dataUrl: string, productName?: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Barcode</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .product-name {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            text-align: center;
          }
          img {
            max-width: 100%;
            height: auto;
          }
          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        ${productName ? `<div class="product-name">${productName}</div>` : ''}
        <img src="${dataUrl}" alt="Barcode" />
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Generate multiple barcodes for batch printing
 * @param items - Array of items with values and names
 * @param barcodeType - Type of barcode ('CODE128' or 'QRCODE')
 * @returns Promise<Array> - Array of Data URLs
 */
export async function generateBatchBarcodes(
  items: Array<{ value: string; name: string }>,
  barcodeType: 'CODE128' | 'QRCODE' = 'CODE128'
): Promise<Array<{ value: string; name: string; dataUrl: string }>> {
  const results = [];
  
  for (const item of items) {
    try {
      const dataUrl = barcodeType === 'CODE128'
        ? await generateCode128Barcode(item.value)
        : await generateQRCode(item.value);
      
      results.push({
        ...item,
        dataUrl
      });
    } catch (error) {
      console.error(`Error generating barcode for ${item.value}:`, error);
      results.push({
        ...item,
        dataUrl: ''
      });
    }
  }
  
  return results;
}

/**
 * Validate barcode format
 * @param value - Barcode value to validate
 * @param format - Expected format
 * @returns boolean
 */
export function validateBarcodeFormat(
  value: string,
  format: 'CODE128' | 'CODE39' | 'SKU'
): boolean {
  switch (format) {
    case 'CODE128':
      // Code 128 can encode ASCII characters
      return value.length > 0 && value.length <= 100;
    
    case 'CODE39':
      // Code 39 supports A-Z, 0-9, and some special characters
      return /^[A-Z0-9\-. $/+%]+$/.test(value);
    
    case 'SKU':
      // VILAGIO SKU format: WB-XXX-XXX
      return /^WB-\d{1,3}-\d{3}$/.test(value);
    
    default:
      return false;
  }
}

/**
 * Parse QR code JSON data
 * @param qrData - Raw QR code string
 * @returns Parsed object or null
 */
export function parseQRCodeData(qrData: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(qrData);
    
    // Validate VILAGIO QR codes
    if (parsed.type && parsed.type.startsWith('VILAGIO_')) {
      return parsed;
    }
    
    return null;
  } catch (error) {
    // Not JSON, return as plain string
    return { type: 'PLAIN', value: qrData };
  }
}

/**
 * Create printable barcode sheet for multiple products
 * @param barcodes - Array of barcode data URLs with product names
 * @param options - Print layout options
 */
export function printBarcodeSheet(
  barcodes: Array<{ dataUrl: string; productName: string; sku: string }>,
  options: {
    columns?: number;
    labelWidth?: string;
    labelHeight?: string;
  } = {}
): void {
  const { columns = 3, labelWidth = '200px', labelHeight = '100px' } = options;
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const barcodeHtml = barcodes
    .map(
      (item) => `
        <div class="label">
          <div class="product-info">
            <div class="product-name">${item.productName}</div>
            <div class="sku">${item.sku}</div>
          </div>
          <img src="${item.dataUrl}" alt="${item.sku}" />
        </div>
      `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Barcode Sheet</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }
          .label-sheet {
            display: grid;
            grid-template-columns: repeat(${columns}, 1fr);
            gap: 10px;
          }
          .label {
            width: ${labelWidth};
            height: ${labelHeight};
            border: 1px dashed #ccc;
            padding: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            page-break-inside: avoid;
          }
          .product-info {
            text-align: center;
            margin-bottom: 5px;
          }
          .product-name {
            font-size: 10px;
            font-weight: bold;
          }
          .sku {
            font-size: 8px;
            color: #666;
          }
          img {
            max-width: 100%;
            height: auto;
          }
          @media print {
            body {
              padding: 0;
            }
            .label {
              border: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="label-sheet">
          ${barcodeHtml}
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export default {
  generateCode128Barcode,
  generateQRCode,
  generateProductQRCode,
  generateLocationQRCode,
  renderCode128ToCanvas,
  downloadBarcode,
  printBarcode,
  generateBatchBarcodes,
  validateBarcodeFormat,
  parseQRCodeData,
  printBarcodeSheet
};
