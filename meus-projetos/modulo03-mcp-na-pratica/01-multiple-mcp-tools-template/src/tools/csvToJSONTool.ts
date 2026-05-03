import { tool } from "@langchain/core/tools";
import csvtojson from "csvtojson";

import { z } from "zod/v3";

export function getCSVTOJSONTool() {
  return tool(
    async ({ csvText }) => {
      const result = await csvtojson().fromString(csvText);
      console.log(
        "[getCSVTOJSONTool] conversion result finished",
        result.length,
        "records",
      );

      return JSON.stringify(result);
    },
    {
      name: "csv_to_json",
      description:
        "Converts CSV data to JSON format. Input should be a string of CSV data.",
      schema: z.object({
        csvText: z.string().describe("The raw CSV data as a string."),
      }),
    },
  );
}
