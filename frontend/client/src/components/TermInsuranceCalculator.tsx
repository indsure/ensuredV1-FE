// TermInsuranceCalculator - Uses LifeInsuranceCalculator with term variant
import { LifeInsuranceCalculator } from "./LifeInsuranceCalculator";

export function TermInsuranceCalculator() {
  return <LifeInsuranceCalculator variant="term" />;
}
