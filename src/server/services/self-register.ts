import { createSelfRegister } from "@convstack/service-sdk/registration";
import { SCHEDULE_MANIFEST } from "~/lib/manifest";

export const registerSchedule = createSelfRegister(SCHEDULE_MANIFEST);
