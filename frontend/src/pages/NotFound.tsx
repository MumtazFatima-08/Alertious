import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <div className="text-sm font-medium text-text">Page not found</div>
      <Link to="/" className="text-xs text-blue hover:underline">
        Back to Overview
      </Link>
    </div>
  );
}
