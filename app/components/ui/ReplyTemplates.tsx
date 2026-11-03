"use client";

const templates = [
  {
    name: "Ring Sync Issue",
    message: `Hi,

Thank you for contacting Atlas Ring.

Please reinstall the Atlas app, reconnect your Ring, and ensure Bluetooth permissions are enabled.

If the issue persists, we'll investigate further.

Regards,
Atlas Ring Support`,
  },

  {
    name: "Refund Request",
    message: `Hi,

We're sorry to hear you'd like a refund.

We've shared your request with our billing team and will update you shortly.

Regards,
Atlas Ring Support`,
  },

  {
    name: "Replacement Request",
    message: `Hi,

We've initiated a replacement request.

Our logistics team will contact you within 24 hours.

Regards,
Atlas Ring Support`,
  },

  {
    name: "Subscription Query",
    message: `Hi,

Thanks for reaching out.

Your subscription details are being reviewed and we'll update you shortly.

Regards,
Atlas Ring Support`,
  },
];

type Props = {
  onSelect: (reply: string) => void;
};

export default function ReplyTemplates({
  onSelect,
}: Props) {
  return (
    <div className="mb-4">
      <label className="mb-2 block text-sm font-medium">
        Templates
      </label>

      <select
        defaultValue=""
        onChange={(e) => {
          const selected = templates.find(
            (t) => t.name === e.target.value
          );

          if (selected) {
            onSelect(selected.message);
          }

          e.target.value = "";
        }}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
      >
        <option value="">
          Select a template...
        </option>

        {templates.map((template) => (
          <option
            key={template.name}
            value={template.name}
          >
            {template.name}
          </option>
        ))}
      </select>
    </div>
  );
}