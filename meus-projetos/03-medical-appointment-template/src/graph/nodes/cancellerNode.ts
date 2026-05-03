import { AppointmentService } from "../../services/appointmentService.ts";
import type { GraphState } from "../graph.ts";

import { z } from "zod/v3";

const ScheduleRequiredFieldsSchema = z.object({
  professionalId: z.number({
    required_error: "Professional ID is required",
  }),
  datetime: z.string({ required_error: "Appointment datetime is required" }),
  patientName: z.string({
    required_error: "Patient name is required",
  }),
});

export function createCancellerNode(appointmentService: AppointmentService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    console.log(`❌ Cancelling appointment...`);

    try {
      const validation = ScheduleRequiredFieldsSchema.safeParse(state);
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

      appointmentService.cancelAppointment(
        validation.data.professionalId,
        validation.data.patientName,
        new Date(validation.data.datetime),
      );

      return {
        actionSuccess: true,
      };
    } catch (error) {
      console.log(
        `❌ Cancellation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return {
        ...state,
        actionSuccess: false,
        actionError:
          error instanceof Error ? error.message : "Cancellation failed",
      };
    }
  };
}
