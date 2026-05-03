import { AppointmentService } from "../../services/appointmentService.ts";
import type { GraphState } from "../graph.ts";

import { z } from "zod/v3";

const RescheduleRequiredFieldsSchema = z.object({
  professionalId: z.number({
    required_error: "Professional ID is required",
  }),
  currentDatetime: z.string({
    required_error: "Current appointment datetime is required",
  }),
  newDatetime: z.string({ required_error: "New appointment datetime is required" }),
  patientName: z.string({
    required_error: "Patient name is required",
  }),
});

export function createReschedulerNode(appointmentService: AppointmentService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    console.log(`🔁 Rescheduling appointment...`);

    try {
      const validation = RescheduleRequiredFieldsSchema.safeParse(state);
      if (!validation.success) {
        const errorMessages = validation.error.errors
          .map((err) => err.message)
          .join("; ");
        console.log(`❌ Validation failed: ${errorMessages}`);

        return {
          actionSuccess: false,
          actionError: errorMessages,
        };
      }

      const appointment = appointmentService.rescheduleAppointment(
        validation.data.professionalId,
        validation.data.patientName,
        new Date(validation.data.currentDatetime),
        new Date(validation.data.newDatetime),
      );

      return {
        ...state,
        datetime: validation.data.newDatetime,
        actionSuccess: true,
        appointmentData: appointment,
      };
    } catch (error) {
      console.log(
        `❌ Rescheduling failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return {
        ...state,
        actionSuccess: false,
        actionError:
          error instanceof Error ? error.message : "Rescheduling failed",
      };
    }
  };
}
