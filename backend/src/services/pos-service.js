// ============================================================================
// POS SERVICE — Point of Sale
// backend/src/services/pos-service.js
// ============================================================================

const { query } = require('../utils/db');
const { v4: uuidv4 } = require('uuid');
const notificationService = require('./notification-service');

// ── Products & Inventory ──────────────────────────────────────────────────────

async function getPOSProducts() {
  const result = await query(`
    SELECT
      p.product_id,
      p.sku,
      p.product_name,
      p.selling_price,
      p.selling_price_zmw,
      p.standard_cost,
      p.base_uom,
      COALESCE(SUM(i.quantity_available), 0) AS total_available
    FROM products p
    LEFT JOIN inventory i ON p.product_id = i.product_id
    WHERE p.sku IN (
      'FD-500ML-REGULAR','FD-500ML-PREMIUM','FD-750ML-REGULAR',
      'FD-5GAL-NEW','FD-5GAL-REFILL','SACHET-WATER-500ML',
      'ICE-SPHERE-1200G','ICE-SPHERE-3600G'
    )
    AND p.is_active = true
    GROUP BY p.product_id, p.sku, p.product_name,
             p.selling_price, p.selling_price_zmw, p.standard_cost, p.base_uom
    ORDER BY p.product_name
  `);
  return result.rows;
}

async function getProductLocations(productId) {
  // FIXED: The missing [productId] parameter has been restored!
  const result = await query(`
    SELECT
      i.inventory_id,
      i.location_id,
      wl.location_code,
      wl.location_name,
      wl.location_type,
      i.quantity_on_hand,
      i.quantity_available,
      i.uom
    FROM inventory i
    JOIN warehouse_locations wl ON i.location_id = wl.location_id
    WHERE i.product_id = $1
      AND i.quantity_available > 0
      AND wl.is_active = true
    ORDER BY i.quantity_available DESC
  `, [productId]);
  return result.rows;
}

// ── Customer Search ───────────────────────────────────────────────────────────

async function searchCustomers(searchTerm) {
  const result = await query(`
    SELECT
      c.customer_id,
      c.vtl_customer_id,
      c.trading_name,
      c.legal_name,
      c.email,
      c.phone,
      c.tier,
      c.tier_name,
      c.territory,
      c.customer_type,
      c.payment_terms,
      c.credit_limit,
      COUNT(st.transaction_id)        AS total_transactions,
      COALESCE(SUM(st.total_amount), 0) AS lifetime_value,
      MAX(st.transaction_date)        AS last_purchase_date
    FROM customers c
    LEFT JOIN sales_transactions st
      ON c.customer_id = st.customer_id AND st.status = 'completed'
    WHERE c.status = 'ACTIVE'
      AND (
        c.trading_name    ILIKE $1
        OR c.legal_name   ILIKE $1
        OR c.vtl_customer_id ILIKE $1
        OR c.email        ILIKE $1
        OR c.territory    ILIKE $1
        OR c.tier_name    ILIKE $1
        OR c.phone        ILIKE $1
      )
    GROUP BY
      c.customer_id, c.vtl_customer_id, c.trading_name, c.legal_name,
      c.email, c.phone, c.tier, c.tier_name, c.territory,
      c.customer_type, c.payment_terms, c.credit_limit
    ORDER BY
      MAX(st.transaction_date) DESC NULLS LAST,
      c.trading_name ASC
    LIMIT 15
  `, [`%${searchTerm}%`]);
  return result.rows;
}

// ── Session Management ────────────────────────────────────────────────────────

async function openSession(cashierId, openingFloat) {
  const existing = await query(`
    SELECT session_id FROM pos_sessions
    WHERE cashier_id = $1 AND status = 'open'
    LIMIT 1
  `, [cashierId]);

  if (existing.rows.length > 0) {
    throw new Error('You already have an open session. Please close it before opening a new one.');
  }

  const numResult = await query(`SELECT generate_pos_session_number() AS session_number`);
  const sessionNumber = numResult.rows[0].session_number;

  const result = await query(`
    INSERT INTO pos_sessions (
      session_number, cashier_id, opened_at,
      opening_float, status
    ) VALUES ($1, $2, NOW(), $3, 'open')
    RETURNING *
  `, [sessionNumber, cashierId, openingFloat || 0]);

  return result.rows[0];
}

async function getActiveSession(cashierId) {
  const result = await query(`
    SELECT
      ps.*,
      u.full_name AS cashier_name
    FROM pos_sessions ps
    JOIN users u ON ps.cashier_id = u.user_id
    WHERE ps.cashier_id = $1 AND ps.status = 'open'
    ORDER BY ps.opened_at DESC
    LIMIT 1
  `, [cashierId]);
  return result.rows[0] || null;
}

async function closeSession(sessionId, cashierId, closingCash, notes) {
  const session = await query(
    `SELECT * FROM pos_sessions WHERE session_id = $1 AND cashier_id = $2`,
    [sessionId, cashierId]
  );
  if (session.rows.length === 0) throw new Error('Session not found');
  if (session.rows[0].status !== 'open') throw new Error('Session is already closed');

  const expectedCash = parseFloat(session.rows[0].opening_float || 0) +
                       parseFloat(session.rows[0].total_sales_amount || 0);

  const result = await query(`
    UPDATE pos_sessions
    SET status        = 'closed',
        closed_at     = NOW(),
        closing_cash  = $1,
        expected_cash = $2,
        notes         = $3,
        updated_at    = NOW()
    WHERE session_id = $4
    RETURNING *
  `, [closingCash, expectedCash, notes || null, sessionId]);

  return result.rows[0];
}

async function getSessionById(sessionId) {
  const result = await query(`
    SELECT
      ps.*,
      u.full_name AS cashier_name,
      u.employee_id AS cashier_employee_id
    FROM pos_sessions ps
    JOIN users u ON ps.cashier_id = u.user_id
    WHERE ps.session_id = $1
  `, [sessionId]);
  return result.rows[0] || null;
}

async function listSessions(filters = {}) {
  const { date_from, date_to, cashier_id, status, limit = 50, offset = 0 } = filters;
  const conditions = ['1=1'];
  const values = [];
  let idx = 1;

  if (date_from)  { conditions.push(`ps.opened_at >= $${idx++}`); values.push(date_from); }
  if (date_to)    { conditions.push(`ps.opened_at <= $${idx++}`); values.push(date_to); }
  if (cashier_id) { conditions.push(`ps.cashier_id = $${idx++}`); values.push(cashier_id); }
  if (status)     { conditions.push(`ps.status = $${idx++}`);     values.push(status); }

  values.push(limit, offset);

  const result = await query(`
    SELECT
      ps.*,
      u.full_name AS cashier_name
    FROM pos_sessions ps
    JOIN users u ON ps.cashier_id = u.user_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ps.opened_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `, values);
  return result.rows;
}

// ── Sales Transactions ────────────────────────────────────────────────────────

async function createTransaction(data, cashierId) {
  const {
    session_id, customer_id, customer_name, lines,
    order_discount_type, order_discount_value, payment_method,
    amount_tendered, cash_amount, mobile_amount, card_amount,
    receipt_email_address, notes,
  } = data;

  if (!lines || lines.length === 0) throw new Error('At least one product line is required');

  // INTACT: Native receipt number generation to bypass broken DB function
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seqRes = await query(`
    SELECT COUNT(*) as count 
    FROM sales_transactions 
    WHERE DATE(transaction_date) = CURRENT_DATE
  `);
  const nextSeq = parseInt(seqRes.rows[0].count) + 1;
  const receiptNumber = `RCPT-${dateStr}-${String(nextSeq).padStart(4, '0')}`;

  let subtotal = 0;
  const evaluatedLines = lines.map(line => {
    const lineSubtotal = parseFloat(line.unit_price) * parseFloat(line.quantity);
    const lineDiscount = parseFloat(line.line_discount || 0);
    const lineTotal = lineSubtotal - lineDiscount;
    subtotal += lineTotal;
    return { ...line, lineSubtotal, lineDiscount, lineTotal };
  });

  let orderDiscountAmount = 0;
  if (order_discount_type === 'percentage' && order_discount_value > 0) {
    orderDiscountAmount = subtotal * (parseFloat(order_discount_value) / 100);
  } else if (order_discount_type === 'fixed' && order_discount_value > 0) {
    orderDiscountAmount = parseFloat(order_discount_value);
  }
  const totalAmount = subtotal - orderDiscountAmount;

  const changGiven = payment_method === 'cash'
    ? Math.max(0, parseFloat(amount_tendered || 0) - totalAmount)
    : 0;

  // Insert the core transaction
  const txResult = await query(`
    INSERT INTO sales_transactions (
      receipt_number, session_id, cashier_id, customer_id, customer_name,
      transaction_date, subtotal,
      order_discount_type, order_discount_value, order_discount_amount,
      total_amount, payment_method,
      amount_tendered, change_given,
      cash_amount, mobile_amount, card_amount,
      receipt_email_address, status, notes
    ) VALUES (
      $1,$2,$3,$4,$5,
      NOW(),$6,
      $7,$8,$9,
      $10,$11,
      $12,$13,
      $14,$15,$16,
      $17,'completed',$18
    ) RETURNING *
  `, [
    receiptNumber, session_id || null, cashierId,
    customer_id || null, customer_name || null,
    subtotal,
    order_discount_type || 'none',
    parseFloat(order_discount_value || 0),
    orderDiscountAmount,
    totalAmount, payment_method,
    parseFloat(amount_tendered || totalAmount),
    changGiven,
    parseFloat(cash_amount || 0),
    parseFloat(mobile_amount || 0),
    parseFloat(card_amount || 0),
    receipt_email_address || null,
    notes || null,
  ]);

  const transaction = txResult.rows[0];

  for (const line of evaluatedLines) {
    // Insert lines
    await query(`
      INSERT INTO sales_transaction_lines (
        transaction_id, product_id, quantity, unit_price,
        line_discount, inventory_location_id, uom
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      transaction.transaction_id,
      line.product_id,
      parseFloat(line.quantity),
      parseFloat(line.unit_price),
      line.lineDiscount,
      line.location_id,
      line.uom || 'piece',
    ]);

    // Deplete inventory
    await query(`
      UPDATE inventory
      SET quantity_on_hand = quantity_on_hand - $1,
          updated_at = NOW()
      WHERE product_id = $2 AND location_id = $3
    `, [parseFloat(line.quantity), line.product_id, line.location_id]);

    // INTACT: Inventory logging correctly using 'transaction_type' instead of missing transaction_number column
    try {
      await query(`
        INSERT INTO inventory_transactions (
          transaction_id, transaction_type,
          product_id, quantity, uom,
          from_location_id, transaction_date,
          performed_by, reference_document_number,
          reference_document_type, status, created_at
        ) VALUES (
          $1, 'sale',
          $2, $3, $4,
          $5, NOW(),
          $6, $7,
          'sales_receipt', 'completed', NOW()
        )
      `, [
        uuidv4(), line.product_id, parseFloat(line.quantity), line.uom || 'piece',
        line.location_id, cashierId, receiptNumber,
      ]);
    } catch (e) {
      try {
        await query(`
          INSERT INTO inventory_transactions (
            transaction_id, transaction_type,
            product_id, quantity, uom,
            from_location_id, transaction_date,
            performed_by, reference_document_number,
            reference_document_type, status, created_at
          ) VALUES (
            $1, 'issue',
            $2, $3, $4,
            $5, NOW(),
            $6, $7,
            'sales_receipt', 'completed', NOW()
          )
        `, [
          uuidv4(), line.product_id, parseFloat(line.quantity), line.uom || 'piece',
          line.location_id, cashierId, receiptNumber,
        ]);
      } catch (e2) {
        console.error('⚠️ Inventory transaction log failed (sale still completed):', e2.message);
      }
    }

    try {
      const stockCheck = await query(`
        SELECT i.quantity_on_hand, p.reorder_point, p.product_name, p.sku
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        WHERE i.product_id = $1 AND i.location_id = $2
      `, [line.product_id, line.location_id]);

      const s = stockCheck.rows[0];
      if (s && s.quantity_on_hand <= (s.reorder_point || 0)) {
        notificationService.notifyLowStock(
          s.product_name, s.sku, s.quantity_on_hand, s.reorder_point
        ).catch(e => console.error('Low stock email failed:', e));
      }
    } catch (e) {
      console.error('Low stock check failed:', e.message);
    }
  }

  // Update session totals
  if (session_id) {
    await query(`
      UPDATE pos_sessions
      SET total_sales_amount  = total_sales_amount + $1,
          total_transactions  = total_transactions + 1,
          updated_at          = NOW()
      WHERE session_id = $2
    `, [totalAmount, session_id]);
  }

  // Fire receipt email
  if (receipt_email_address) {
    try {
      await sendReceiptEmail(transaction.transaction_id, receipt_email_address);
    } catch (e) {
      console.error('Receipt email failed:', e.message);
    }
  }

  return getTransactionById(transaction.transaction_id);
}

async function getTransactionById(transactionId) {
  const txResult = await query(`
    SELECT
      st.*,
      u.full_name   AS cashier_name,
      u.employee_id AS cashier_employee_id,
      c.trading_name AS customer_trading_name,
      c.vtl_customer_id
    FROM sales_transactions st
    JOIN users u ON st.cashier_id = u.user_id
    LEFT JOIN customers c ON st.customer_id = c.customer_id
    WHERE st.transaction_id = $1
  `, [transactionId]);

  if (txResult.rows.length === 0) return null;

  const linesResult = await query(`
    SELECT
      stl.*,
      p.product_name,
      p.sku,
      wl.location_code,
      wl.location_name
    FROM sales_transaction_lines stl
    JOIN products p ON stl.product_id = p.product_id
    JOIN warehouse_locations wl ON stl.inventory_location_id = wl.location_id
    WHERE stl.transaction_id = $1
    ORDER BY stl.created_at
  `, [transactionId]);

  return {
    ...txResult.rows[0],
    lines: linesResult.rows,
  };
}

async function listTransactions(filters = {}) {
  const {
    session_id, customer_id, date_from, date_to,
    cashier_id, status, limit = 50, offset = 0
  } = filters;

  const conditions = ['1=1'];
  const values = [];
  let idx = 1;

  if (session_id)  { conditions.push(`st.session_id = $${idx++}`);    values.push(session_id); }
  if (customer_id) { conditions.push(`st.customer_id = $${idx++}`);   values.push(customer_id); }
  if (cashier_id)  { conditions.push(`st.cashier_id = $${idx++}`);    values.push(cashier_id); }
  if (status)      { conditions.push(`st.status = $${idx++}`);        values.push(status); }
  if (date_from)   { conditions.push(`st.transaction_date >= $${idx++}`); values.push(date_from); }
  if (date_to)     { conditions.push(`st.transaction_date <= $${idx++}`); values.push(date_to); }

  values.push(limit, offset);

  const result = await query(`
    SELECT
      st.*,
      u.full_name AS cashier_name,
      c.trading_name AS customer_name_display,
      COUNT(stl.line_id) AS line_count
    FROM sales_transactions st
    JOIN users u ON st.cashier_id = u.user_id
    LEFT JOIN customers c ON st.customer_id = c.customer_id
    LEFT JOIN sales_transaction_lines stl ON st.transaction_id = stl.transaction_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY st.transaction_id, u.full_name, c.trading_name
    ORDER BY st.transaction_date DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `, values);

  return result.rows;
}

async function voidTransaction(transactionId, cashierId, reason) {
  const tx = await getTransactionById(transactionId);
  if (!tx) throw new Error('Transaction not found');
  if (tx.status === 'voided') throw new Error('Transaction is already voided');

  for (const line of tx.lines) {
    await query(`
      UPDATE inventory
      SET quantity_on_hand = quantity_on_hand + $1,
          updated_at = NOW()
      WHERE product_id = $2 AND location_id = $3
    `, [parseFloat(line.quantity), line.product_id, line.inventory_location_id]);
  }

  if (tx.session_id) {
    await query(`
      UPDATE pos_sessions
      SET total_sales_amount = total_sales_amount - $1,
          total_transactions  = total_transactions - 1,
          total_voids         = total_voids + 1,
          updated_at          = NOW()
      WHERE session_id = $2
    `, [tx.total_amount, tx.session_id]);
  }

  await query(`
    UPDATE sales_transactions
    SET status = 'voided', void_reason = $1,
        voided_by = $2, voided_at = NOW(), updated_at = NOW()
    WHERE transaction_id = $3
  `, [reason, cashierId, transactionId]);

  return getTransactionById(transactionId);
}

// ── Dashboard Stats ───────────────────────────────────────────────────────────

async function getPOSDashboardStats() {
  const result = await query(`
    SELECT
      COUNT(*) FILTER (WHERE transaction_date >= CURRENT_DATE)         AS sales_today,
      COALESCE(SUM(total_amount) FILTER (WHERE transaction_date >= CURRENT_DATE), 0) AS revenue_today,
      COUNT(*) FILTER (WHERE transaction_date >= DATE_TRUNC('month', CURRENT_DATE)) AS sales_this_month,
      COALESCE(SUM(total_amount) FILTER (WHERE transaction_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS revenue_this_month,
      COUNT(*) FILTER (WHERE status = 'voided' AND transaction_date >= CURRENT_DATE) AS voids_today,
      COUNT(DISTINCT customer_id) FILTER (WHERE transaction_date >= CURRENT_DATE AND customer_id IS NOT NULL) AS unique_customers_today
    FROM sales_transactions
    WHERE status IN ('completed','voided')
  `);
  return result.rows[0];
}

// ── Receipt Email ─────────────────────────────────────────────────────────────

async function sendReceiptEmail(transactionId, emailAddress, currency = 'USD', exchangeRate = 27) {
  const tx = await getTransactionById(transactionId);
  if (!tx) throw new Error('Transaction not found');

  const { Resend } = require('resend');
  const resend = new Resend(process.env.SMTP_PASS);

  // Dynamic Currency Formatter
  const rate = parseFloat(exchangeRate) || 27;
  const sym = currency === 'ZMW' ? 'K' : '$';
  const fmt = (usdVal) => `${sym}${(parseFloat(usdVal) * (currency === 'ZMW' ? rate : 1)).toFixed(2)}`;

  // VAT Calculation (Prices are VAT Inclusive)
  const totalInclVat = parseFloat(tx.total_amount);
  const totalExclVat = totalInclVat / 1.16; 
  const vatAmount = totalInclVat - totalExclVat;

  const lineRows = tx.lines.map(l => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;">${l.product_name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;color:#334155;">${l.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#334155;">${fmt(l.unit_price)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#0F172A;">${fmt(l.line_total)}</td>
    </tr>`
  ).join('');

  // Dynamic Loyalty/Registration Banner
  let loyaltyBanner = '';
  if (!tx.customer_id) {
    // Unregistered / Retail Walk-in
    loyaltyBanner = `
      <div style="background:#F0FDF4;padding:20px;border-radius:8px;margin-top:24px;border-left:4px solid #22C55E;">
        <h3 style="margin:0 0 8px;color:#166534;font-size:16px;">Join the FreshDrip Loyalty Program! 💧</h3>
        <p style="margin:0 0 12px;color:#15803D;font-size:13px;line-height:1.5;">Love our water? Register as a Retail Customer to enjoy automated repeat orders, fast-tracked checkouts, and exclusive discounts.</p>
        <p style="margin:0;color:#15803D;font-size:13px;"><strong>How to join:</strong> Simply reply to this email with your <em>Full Name, Phone Number, and Delivery Address</em>.</p>
      </div>
      <div style="background:#EFF6FF;padding:20px;border-radius:8px;margin-top:12px;border-left:4px solid #3B82F6;">
        <h3 style="margin:0 0 8px;color:#1E3A8A;font-size:16px;">Are you a Business? 🏢</h3>
        <p style="margin:0 0 12px;color:#1D4ED8;font-size:13px;line-height:1.5;">Open a B2B Commercial Account for wholesale pricing and flexible credit terms.</p>
        <p style="margin:0;color:#1D4ED8;font-size:13px;"><strong>Requirements:</strong> Reply with your <em>TPIN Certificate, PACRA Registration, and Director's ID</em> to begin onboarding.</p>
      </div>
    `;
  } else {
    // Registered B2B / Loyal Customer
    loyaltyBanner = `
      <div style="background:#F0FDF4;padding:20px;border-radius:8px;margin-top:24px;border-left:4px solid #22C55E;">
        <h3 style="margin:0 0 8px;color:#166534;font-size:16px;">Thank you for being a Vilagio Partner! 💧</h3>
        <p style="margin:0;color:#15803D;font-size:13px;line-height:1.5;">Your loyalty drives us. Ask your sales rep about our volume-based rebate tiers on your next order!</p>
      </div>
    `;
  }

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;background:#ffffff;">
      <div style="background:#0F172A;padding:32px 24px;text-align:center;">
        <img src="https://vilagio-erp-frontend.vercel.app/logo-white.png" alt="Vilagio Logo" style="height:48px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;" />
        <h1 style="color:#FFFFFF;margin:0;font-size:22px;letter-spacing:1px;font-weight:600;">Tax Invoice / Official Receipt</h1>
      </div>
      
      <div style="padding:32px 24px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:32px;border-bottom:2px solid #F1F5F9;padding-bottom:24px;">
          <div>
            <h3 style="margin:0 0 8px;color:#0F172A;font-size:15px;">Vilagio Trading Limited</h3>
            <p style="margin:0;color:#64748B;font-size:13px;line-height:1.6;">Plot 28441 50/50<br/>Kitwe Road, Chingola<br/>Email: info@vilag.io<br/>Tel: +260571669256</p>
          </div>
          <div style="text-align:right;">
            <p style="margin:0 0 6px;font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Receipt Number</p>
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#0F172A;">${tx.receipt_number}</p>
            <p style="margin:0;font-size:13px;color:#64748B;">${new Date(tx.transaction_date).toLocaleString('en-GB')}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#64748B;">Cashier: ${tx.cashier_name}</p>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
          <thead>
            <tr style="background:#F8FAFC;">
              <th style="padding:12px;color:#475569;text-align:left;font-weight:600;border-radius:6px 0 0 6px;">Product</th>
              <th style="padding:12px;color:#475569;text-align:center;font-weight:600;">Qty</th>
              <th style="padding:12px;color:#475569;text-align:right;font-weight:600;">Price</th>
              <th style="padding:12px;color:#475569;text-align:right;font-weight:600;border-radius:0 6px 6px 0;">Total</th>
            </tr>
          </thead>
          <tbody>${lineRows}</tbody>
        </table>

        <div style="width:100%;max-width:300px;margin-left:auto;border-top:2px solid #E2E8F0;padding-top:16px;">
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#64748B;margin-bottom:8px;">
            <span>Subtotal (Excl. VAT)</span><span>${fmt(totalExclVat)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#64748B;margin-bottom:8px;">
            <span>VAT (16%)</span><span>${fmt(vatAmount)}</span>
          </div>
          ${parseFloat(tx.order_discount_amount) > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#DC2626;margin-bottom:8px;">
            <span>Discount Applied</span><span>-${fmt(tx.order_discount_amount)}</span>
          </div>` : ''}

          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;color:#0F172A;margin-top:12px;border-top:1px solid #E2E8F0;padding-top:12px;">
            <span>Total (Incl. VAT)</span><span style="color:#2563EB;">${fmt(totalInclVat)}</span>
          </div>
        </div>

        <div style="margin-top:24px;padding:16px;background:#F8FAFC;border-radius:8px;font-size:13px;color:#475569;text-align:center;">
          Payment Method: <strong style="color:#0F172A;">${tx.payment_method.toUpperCase()}</strong>
          ${parseFloat(tx.change_given) > 0 ? ` &nbsp;|&nbsp; Change Given: <strong style="color:#0F172A;">${fmt(tx.change_given)}</strong>` : ''}
        </div>

        ${loyaltyBanner}
        
      </div>
      
      <div style="background:#F1F5F9;padding:24px;text-align:center;border-top:1px solid #E2E8F0;">
        <p style="color:#64748B;font-size:12px;margin:0;">Prices are inclusive of 16% VAT where applicable.</p>
        <p style="color:#64748B;font-size:12px;margin:6px 0 0;">&copy; ${new Date().getFullYear()} Vilagio Trading Limited. All rights reserved.</p>
      </div>
    </div>`;

  const { error } = await resend.emails.send({
    from: `Vilagio ERP <${process.env.EMAIL_FROM || 'noreply@vilag.io'}>`,
    to: [emailAddress],
    reply_to: 'sales@vilag.io',
    subject: `Tax Invoice / Receipt — ${tx.receipt_number}`,
    html,
  });

  if (error) throw new Error(`Receipt email failed: ${error.message}`);

  await query(`
    UPDATE sales_transactions
    SET receipt_emailed = true, receipt_email_address = $1, updated_at = NOW()
    WHERE transaction_id = $2
  `, [emailAddress, transactionId]);
}

module.exports = {
  getPOSProducts,
  getProductLocations,
  searchCustomers,
  openSession,
  getActiveSession,
  closeSession,
  getSessionById,
  listSessions,
  createTransaction,
  getTransactionById,
  listTransactions,
  voidTransaction,
  getPOSDashboardStats,
  sendReceiptEmail,
};