import { useEffect } from "react";
import type { JobItem } from "@/types/hrx";

export function JobStructuredData({ jobs }: { jobs: JobItem[] }) {
  useEffect(() => {
    const existingScript = document.getElementById("job-structured-data");
    if (existingScript) existingScript.remove();

    if (jobs.length === 0) return;

    const jobPostings = jobs.slice(0, 20).map((job) => ({
      "@type": "JobPosting",
      title: job.title,
      description: job.description || job.title,
      datePosted: job.publishedAt || new Date().toISOString().split("T")[0],
      employmentType: "FULL_TIME",
      jobLocationType: "TELECOMMUTE",
      hiringOrganization: {
        "@type": "Organization",
        name: job.company || "Не указано",
      },
      applicantLocationRequirements: {
        "@type": "Country",
        name: "RU",
      },
      ...(job.salaryFrom || job.salaryTo
        ? {
            baseSalary: {
              "@type": "MonetaryAmount",
              currency: "RUB",
              value: {
                "@type": "QuantitativeValue",
                ...(job.salaryFrom ? { minValue: job.salaryFrom } : {}),
                ...(job.salaryTo ? { maxValue: job.salaryTo } : {}),
                unitText: "MONTH",
              },
            },
          }
        : {}),
    }));

    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": jobPostings,
    };

    const script = document.createElement("script");
    script.id = "job-structured-data";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    return () => {
      const el = document.getElementById("job-structured-data");
      if (el) el.remove();
    };
  }, [jobs]);

  return null;
}
