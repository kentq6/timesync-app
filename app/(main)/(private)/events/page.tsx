import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import Link from "next/link";

export default function Page() {
  return (
    <section className="flex flex-col items-center gap-16 animate-fade-in">
      {/* Page title and "New Event" button */}
      <div className="flex gap-4 items-baseline">
        <h1 className="text-4xl xl:text-5xl font-black mb-6">
          Events
        </h1>
        {/* Without asChild, the Button would render as:
          <button><a href="/dashboard"< Go to Dashboard</a></button> <!-- Invalid HTML -->
          With asChild, it renders as:
          <a href="/dashboard" class="...button styles...">Go to Dashboard</a> <!-- Valid HTML -->
        */}
        <Button 
          className="bg-blue-500 hover:bg-blue-400 text-white py-6 hover:scale-110 duration-500 border-b-4 border-blue-700 hover:border-blue-500 rounded-2xl shadow-accent-foreground text-2xl font-black" asChild>
          <Link href="/events/new">
            <CalendarPlus className="mr-4 size-7" />Create Event
          </Link>
        </Button>
      </div>
    </section>
  )
}