-- Migration to add availabilityId to time_slots table
-- Run this SQL command on your database

ALTER TABLE time_slots 
ADD COLUMN availabilityId INT NULL,
ADD CONSTRAINT fk_time_slots_availability 
FOREIGN KEY (availabilityId) REFERENCES caregiveravailabilities(id) 
ON DELETE SET NULL;