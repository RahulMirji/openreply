import type { Metadata } from "next";
import Demo from "@/components/ui/demo";

export const metadata: Metadata = {
  title: "AI Chat Input Demo | OpenReply",
  description: "Interactive demo for the expandable AI chat prompt input.",
};

export default function DemoPage() {
  return <Demo />;
}
