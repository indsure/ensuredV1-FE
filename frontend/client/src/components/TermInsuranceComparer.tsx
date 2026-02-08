// TermInsuranceComparer - Uses same comparison logic but with term-specific messaging
import { LifeInsuranceComparer } from "./LifeInsuranceComparer";

export function TermInsuranceComparer() {
  // The comparison table and logic are identical for term life insurance
  // We just need to ensure the messaging emphasizes "term life" and "pure protection"
  // The LifeInsuranceComparer already handles this via the query parameter
  return <LifeInsuranceComparer />;
}
