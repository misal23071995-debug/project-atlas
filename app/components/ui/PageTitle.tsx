type PageTitleProps = {
    eyebrow?: string;
    title: string;
    description?: string;
  };
  
  export default function PageTitle({
    eyebrow,
    title,
    description,
  }: PageTitleProps) {
    return (
      <div className="mb-8">
        {eyebrow && (
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
            {eyebrow}
          </p>
        )}
  
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
  
        {description && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
    );
  }