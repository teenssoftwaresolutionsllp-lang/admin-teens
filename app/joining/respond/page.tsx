import { notFound } from "next/navigation";
import OfferResponseForm from "./OfferResponseForm";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    token?: string;
    action?: string;
  }>;
};

export default async function OfferRespondPage({
  searchParams,
}: Props) {
  const params = await searchParams;

  const token =
    typeof params.token === "string" &&
    /^[a-f0-9]{64}$/i.test(params.token)
      ? params.token
      : "";

  const action =
    params.action === "accept_offer" ||
    params.action === "decline_offer"
      ? params.action
      : null;

  if (!token || !action) {
    notFound();
  }

  return <OfferResponseForm token={token} action={action} />;
}