/**
 * Ripperdoc Scheduling API Client
 * 
 * Interface to the Night City street surgeon scheduling system (Elixir API).
 * Handles appointment booking and cancellations.
 */

const RIPPERDOC_API_URL = process.env.RIPPERDOC_API_URL || 'http://localhost:8001';

// ============================================================================
// TYPES
// ============================================================================

export interface AppointmentRequest {
  runnerId: string;
  runnerHandle: string;
  cyberwareName: string;
  cyberwareGrade: string;
  preferredRipperdoc?: string;
}

export interface Appointment {
  appointmentId: string;
  runnerId: string;
  runnerHandle: string;
  ripperdocId: string;
  ripperdocName: string;
  location: string;
  cyberwareName: string;
  cyberwareGrade: string;
  installationType: string;
  scheduledTime: Date;
  surgeryFee: number;
  depositPaid: number;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface CancellationResult {
  appointmentId: string;
  cancelledAt: Date;
  reason: string;
  depositRefunded: boolean;
}

export interface Ripperdoc {
  id: string;
  name: string;
  location: string;
  specialty: string;
  rating: number;
  baseFee: number;
  available: boolean;
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Schedule an appointment with a ripperdoc.
 */
export async function createAppointment(
  request: AppointmentRequest
): Promise<Appointment> {
  console.log(`[RIPPERDOC API CLIENT] Scheduling appointment at ${RIPPERDOC_API_URL}`);
  
  const response = await fetch(`${RIPPERDOC_API_URL}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      runner_id: request.runnerId,
      runner_handle: request.runnerHandle,
      cyberware_name: request.cyberwareName,
      cyberware_grade: request.cyberwareGrade,
      preferred_ripperdoc: request.preferredRipperdoc,
    })
  });
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Ripperdoc API error (${response.status}): ${errorBody.message || response.statusText}`);
  }
  
  const data = await response.json();
  
  const appointment: Appointment = {
    appointmentId: data.appointment_id,
    runnerId: data.runner_id,
    runnerHandle: data.runner_handle,
    ripperdocId: data.ripperdoc_id,
    ripperdocName: data.ripperdoc_name,
    location: data.location,
    cyberwareName: data.cyberware_name,
    cyberwareGrade: data.cyberware_grade,
    installationType: data.installation_type,
    scheduledTime: new Date(data.scheduled_time),
    surgeryFee: data.surgery_fee,
    depositPaid: data.deposit_paid,
    status: data.status,
  };
  
  console.log(`[RIPPERDOC API CLIENT] ✓ Appointment scheduled: ${appointment.appointmentId}`);
  console.log(`[RIPPERDOC API CLIENT]   Doc: ${appointment.ripperdocName} @ ${appointment.location}`);
  return appointment;
}

/**
 * Cancel an appointment.
 */
export async function cancelAppointment(
  appointmentId: string,
  reason: string
): Promise<CancellationResult> {
  console.log(`[RIPPERDOC API CLIENT] Cancelling appointment ${appointmentId}`);
  
  const response = await fetch(`${RIPPERDOC_API_URL}/appointments/${appointmentId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Ripperdoc API error (${response.status}): ${errorBody.message || response.statusText}`);
  }
  
  const data = await response.json();
  
  return {
    appointmentId: data.appointment_id,
    cancelledAt: new Date(data.cancelled_at),
    reason: data.reason,
    depositRefunded: data.deposit_refunded,
  };
}

/**
 * Get appointment details.
 */
export async function getAppointment(appointmentId: string): Promise<Appointment> {
  const response = await fetch(`${RIPPERDOC_API_URL}/appointments/${appointmentId}`);
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Ripperdoc API error (${response.status}): ${errorBody.message || response.statusText}`);
  }
  
  const data = await response.json();
  
  return {
    appointmentId: data.appointment_id,
    runnerId: data.runner_id,
    runnerHandle: data.runner_handle,
    ripperdocId: data.ripperdoc_id,
    ripperdocName: data.ripperdoc_name,
    location: data.location,
    cyberwareName: data.cyberware_name,
    cyberwareGrade: data.cyberware_grade,
    installationType: data.installation_type,
    scheduledTime: new Date(data.scheduled_time),
    surgeryFee: data.surgery_fee,
    depositPaid: data.deposit_paid,
    status: data.status,
  };
}

/**
 * List all available ripperdocs.
 */
export async function listRipperdocs(): Promise<Ripperdoc[]> {
  const response = await fetch(`${RIPPERDOC_API_URL}/ripperdocs`);
  
  if (!response.ok) {
    throw new Error(`Ripperdoc API error (${response.status}): ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.ripperdocs.map((doc: any) => ({
    id: doc.id,
    name: doc.name,
    location: doc.location,
    specialty: doc.specialty,
    rating: doc.rating,
    baseFee: doc.base_fee,
    available: doc.available,
  }));
}

/**
 * Health check.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${RIPPERDOC_API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
