import CandidateOnboardingForm from "@/components/CandidateOnboardingForm";

type PageProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function CandidateOnboardingPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const token = Array.isArray(params.token)
    ? params.token[0] ?? ""
    : params.token ?? "";

  return <CandidateOnboardingForm token={token} />;
}