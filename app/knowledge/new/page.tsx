import DashboardLayout from "@/app/components/dashboard-layout";
import ArticleForm from "../ArticleForm";

export default function NewArticlePage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">New article</h1>
        <ArticleForm />
      </div>
    </DashboardLayout>
  );
}
