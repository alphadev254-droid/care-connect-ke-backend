-- Create withdrawal_tokens table for secure withdrawal verification
CREATE TABLE IF NOT EXISTS withdrawal_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  caregiver_id INT NOT NULL,
  token VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  INDEX idx_caregiver_token (caregiver_id, token),
  INDEX idx_expires_at (expires_at)
);

-- Add payment reference to withdrawal_requests if not exists
ALTER TABLE withdrawal_requests 
ADD COLUMN IF NOT EXISTS payout_reference VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS paychangu_response JSON,
ADD COLUMN IF NOT EXISTS failure_reason TEXT,
ADD COLUMN IF NOT EXISTS processed_at DATETIME;