"use client";

import { useRouter } from "next/navigation";
import { ListingForm } from "@/components/listing-form";
import { useRequireSignIn } from "@/components/session";
import { Loading, Page } from "@/components/shell";
import { toast } from "@/components/toast";
import { PageTitle } from "@/components/ui";
import { api } from "@/lib/api";

export default function SellPage() {
  const router = useRouter();
  const { me, loading } = useRequireSignIn();
  if (loading || !me) return <Loading />;
  return (
    <Page>
      <PageTitle
        eyebrow="Sell your land"
        title={
          <>
            List it once. <span className="text-earth-600 italic">Keep it all.</span>
          </>
        }
        subtitle="Land in Enugu State, for now. Tell buyers about it, add photos and your title papers, then send it to us: we search the title at the Enugu State Ministry of Lands and publish it. Listing is free."
      />
      <ListingForm
        submitLabel="Save and add photos"
        onSubmit={async (input) => {
          const r = await api<{ listing: { id: string } }>("/listings", "POST", input);
          toast("Saved. Now add photos and papers.");
          router.push(`/dashboard/listings/${r.listing.id}`);
        }}
      />
    </Page>
  );
}
