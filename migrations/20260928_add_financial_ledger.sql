ALTER TABLE caregiver_earnings ADD COLUMN reserved_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER locked_balance, ADD COLUMN total_paid DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER reserved_balance;
ALTER TABLE withdrawal_tokens MODIFY COLUMN token VARCHAR(64) NOT NULL, ADD COLUMN attempt_count INT NOT NULL DEFAULT 0 AFTER used;
ALTER TABLE caresessionreports ADD UNIQUE KEY uq_care_session_report_appointment (appointmentId);
ALTER TABLE paymenttransactions MODIFY COLUMN stripePaymentIntentId VARCHAR(191) NULL, ADD UNIQUE KEY uq_payment_paychangu_reference (stripePaymentIntentId);

CREATE TABLE ledger_accounts (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, account_key VARCHAR(191) NOT NULL,
 caregiver_id INT NULL, account_type ENUM('caregiver_locked','caregiver_available','caregiver_reserved','paychangu_clearing','withdrawal_fee_revenue','migration_opening') NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'MWK', current_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_ledger_account_key (account_key), KEY idx_ledger_account_caregiver (caregiver_id),
 CONSTRAINT fk_ledger_account_caregiver FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE ledger_transactions (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, event_type VARCHAR(50) NOT NULL, reference_type VARCHAR(50) NOT NULL,
 reference_id VARCHAR(191) NOT NULL, idempotency_key VARCHAR(191) NOT NULL, currency CHAR(3) NOT NULL DEFAULT 'MWK',
 description VARCHAR(255) NULL, metadata JSON NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_ledger_transaction_idempotency (idempotency_key), KEY idx_ledger_transaction_reference (reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE ledger_entries (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, ledger_transaction_id INT NOT NULL, account_id INT NOT NULL,
 direction ENUM('debit','credit') NOT NULL, amount DECIMAL(14,2) NOT NULL,
 balance_before DECIMAL(14,2) NOT NULL, balance_after DECIMAL(14,2) NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'MWK', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_ledger_entry_transaction (ledger_transaction_id), KEY idx_ledger_entry_account (account_id, created_at),
 CONSTRAINT fk_ledger_entry_transaction FOREIGN KEY (ledger_transaction_id) REFERENCES ledger_transactions(id),
 CONSTRAINT fk_ledger_entry_account FOREIGN KEY (account_id) REFERENCES ledger_accounts(id),
 CONSTRAINT chk_ledger_entry_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ledger_accounts (account_key,caregiver_id,account_type,currency,current_balance) SELECT CONCAT('caregiver:',caregiver_id,':caregiver_locked:MWK'),caregiver_id,'caregiver_locked','MWK',locked_balance FROM caregiver_earnings;
INSERT INTO ledger_accounts (account_key,caregiver_id,account_type,currency,current_balance) SELECT CONCAT('caregiver:',caregiver_id,':caregiver_available:MWK'),caregiver_id,'caregiver_available','MWK',wallet_balance FROM caregiver_earnings;
INSERT INTO ledger_accounts (account_key,caregiver_id,account_type,currency,current_balance) SELECT CONCAT('caregiver:',caregiver_id,':caregiver_reserved:MWK'),caregiver_id,'caregiver_reserved','MWK',0 FROM caregiver_earnings;
INSERT INTO ledger_accounts (account_key,caregiver_id,account_type,currency,current_balance) SELECT CONCAT('system:migration_opening:',caregiver_id,':MWK'),caregiver_id,'migration_opening','MWK',-(locked_balance+wallet_balance) FROM caregiver_earnings WHERE locked_balance+wallet_balance>0;
INSERT INTO ledger_transactions (event_type,reference_type,reference_id,idempotency_key,currency,description) SELECT 'migration_opening','caregiver',caregiver_id,CONCAT('migration-opening:',caregiver_id),'MWK','Opening balance migrated from caregiver_earnings' FROM caregiver_earnings WHERE locked_balance+wallet_balance>0;
INSERT INTO ledger_entries (ledger_transaction_id,account_id,direction,amount,balance_before,balance_after,currency) SELECT t.id,a.id,'debit',e.locked_balance+e.wallet_balance,0,-(e.locked_balance+e.wallet_balance),'MWK' FROM caregiver_earnings e JOIN ledger_transactions t ON t.idempotency_key=CONCAT('migration-opening:',e.caregiver_id) JOIN ledger_accounts a ON a.account_key=CONCAT('system:migration_opening:',e.caregiver_id,':MWK') WHERE e.locked_balance+e.wallet_balance>0;
INSERT INTO ledger_entries (ledger_transaction_id,account_id,direction,amount,balance_before,balance_after,currency) SELECT t.id,a.id,'credit',e.locked_balance,0,e.locked_balance,'MWK' FROM caregiver_earnings e JOIN ledger_transactions t ON t.idempotency_key=CONCAT('migration-opening:',e.caregiver_id) JOIN ledger_accounts a ON a.account_key=CONCAT('caregiver:',e.caregiver_id,':caregiver_locked:MWK') WHERE e.locked_balance>0;
INSERT INTO ledger_entries (ledger_transaction_id,account_id,direction,amount,balance_before,balance_after,currency) SELECT t.id,a.id,'credit',e.wallet_balance,0,e.wallet_balance,'MWK' FROM caregiver_earnings e JOIN ledger_transactions t ON t.idempotency_key=CONCAT('migration-opening:',e.caregiver_id) JOIN ledger_accounts a ON a.account_key=CONCAT('caregiver:',e.caregiver_id,':caregiver_available:MWK') WHERE e.wallet_balance>0;
UPDATE caregiver_earnings e SET total_paid=COALESCE((SELECT SUM(w.requested_amount) FROM withdrawal_requests w WHERE w.caregiver_id=e.caregiver_id AND w.status='completed'),0);
