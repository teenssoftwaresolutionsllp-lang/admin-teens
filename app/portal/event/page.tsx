
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  Image as ImageIcon,
  CalendarHeart,
  PartyPopper,
  Loader2,
  X,
  ChevronRight,
  Camera,
} from "lucide-react";

type EventPhoto = {
  id: string;
  photo_url: string;
};

type CompanyEvent = {
  id: string;
  title: string;
  description?: string | null;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  invitation_image_url?: string | null;
  status: "published" | "cancelled" | "draft";
  event_photos?: EventPhoto[];
};

type EventsResponse = {
  events?: CompanyEvent[];
  data?: CompanyEvent[];
  error?: string;
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(time?: string | null) {
  if (!time) return "";

  const [hours, minutes] = time.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function EmployeeEventsPage() {
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "upcoming" | "past" | "gallery"
  >("upcoming");
  const [selectedEvent, setSelectedEvent] =
    useState<CompanyEvent | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

  
async function loadEvents() {
  try {
    setLoading(true);
    setError("");

    const response = await fetch("/api/event", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    const contentType = response.headers.get("content-type") || "";

    // Check whether API returned JSON
    if (!contentType.includes("application/json")) {
      const responseText = await response.text();

      console.error("Events API returned HTML:", {
        status: response.status,
        url: response.url,
        response: responseText.slice(0, 500),
      });

      throw new Error(
        `Events API returned an invalid response. Status: ${response.status}.`
      );
    }

const result: EventsResponse = await response.json();

if (!response.ok) {
  console.error("EVENT API STATUS:", response.status);
  console.error("EVENT API URL:", response.url);
  console.error("EVENT API RESPONSE:", JSON.stringify(result, null, 2));

  throw new Error(
    result.error || `Unable to load events. Status: ${response.status}`
  );
}

    if (active) {
      const receivedEvents = result.events || result.data || [];

      setEvents(
        receivedEvents.filter(
          (event) => event.status === "published"
        )
      );
    }
  } catch (err) {
    console.error("Load events error:", err);

    if (active) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading events."
      );
    }
  } finally {
    if (active) {
      setLoading(false);
    }
  }
}

    loadEvents();

    return () => {
      active = false;
    };
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((event) => {
          const eventDate = new Date(`${event.event_date}T00:00:00`);
          return eventDate >= today;
        })
        .sort(
          (a, b) =>
            new Date(a.event_date).getTime() -
            new Date(b.event_date).getTime()
        ),
    [events]
  );

  const pastEvents = useMemo(
    () =>
      events
        .filter((event) => {
          const eventDate = new Date(`${event.event_date}T00:00:00`);
          return eventDate < today;
        })
        .sort(
          (a, b) =>
            new Date(b.event_date).getTime() -
            new Date(a.event_date).getTime()
        ),
    [events]
  );

  const allPhotos = events.flatMap((event) =>
    (event.event_photos || []).map((photo) => ({
      ...photo,
      eventTitle: event.title,
      eventDate: event.event_date,
    }))
  );

  function EventCard({ event }: { event: CompanyEvent }) {
    return (
      <button
        type="button"
        onClick={() => setSelectedEvent(event)}
        className="group overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
      >
        <div className="relative h-48 overflow-hidden bg-gray-100">
          {event.invitation_image_url ? (
            <img
              src={event.invitation_image_url}
              alt={event.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-100 to-pink-100">
              <PartyPopper className="h-12 w-12 text-orange-500" />
            </div>
          )}

          <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow">
            {new Date(`${event.event_date}T00:00:00`) >= today
              ? "Upcoming"
              : "Completed"}
          </span>
        </div>

        <div className="p-5">
          <h3 className="text-lg font-semibold text-gray-900">
            {event.title}
          </h3>

          <p className="mt-2 line-clamp-2 text-sm text-gray-500">
            {event.description || "Company event"}
          </p>

          <div className="mt-4 space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-orange-500" />
              {formatDate(event.event_date)}
            </div>

            {event.start_time && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                {formatTime(event.start_time)}
                {event.end_time && ` - ${formatTime(event.end_time)}`}
              </div>
            )}

            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-orange-500" />
                {event.location}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-sm font-medium text-orange-600">
            View event details
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </button>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Page heading */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <CalendarHeart className="h-7 w-7 text-orange-500" />
              <h1 className="text-2xl font-bold text-gray-900">
                Company Events
              </h1>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Stay connected with celebrations and activities happening
              across our company.
            </p>
          </div>

          <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
            <p className="text-xs font-medium text-orange-600">
              Upcoming Events
            </p>
            <p className="mt-1 text-2xl font-bold text-orange-700">
              {upcomingEvents.length}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { id: "upcoming", label: "Upcoming Events" },
            { id: "past", label: "Past Events" },
            { id: "gallery", label: "Photo Gallery" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setActiveTab(tab.id as "upcoming" | "past" | "gallery")
              }
              className={`rounded-xl px-5 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-orange-500 text-white shadow-sm"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex min-h-64 items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-500" />
              <p className="mt-3 text-sm text-gray-500">
                Loading company events...
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-3 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Upcoming */}
        {!loading && !error && activeTab === "upcoming" && (
          <>
            {upcomingEvents.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {upcomingEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <EmptyState message="No upcoming events right now." />
            )}
          </>
        )}

        {/* Past */}
        {!loading && !error && activeTab === "past" && (
          <>
            {pastEvents.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {pastEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <EmptyState message="No past events available." />
            )}
          </>
        )}

        {/* Gallery */}
        {!loading && !error && activeTab === "gallery" && (
          <>
            {allPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {allPhotos.map((photo) => (
                  <button
                    type="button"
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo.photo_url)}
                    className="group overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm"
                  >
                    <div className="h-40 overflow-hidden bg-gray-100">
                      <img
                        src={photo.photo_url}
                        alt={photo.eventTitle}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-semibold text-gray-800">
                        {photo.eventTitle}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDate(photo.eventDate)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState message="Event photos will appear here after HR uploads them." />
            )}
          </>
        )}
      </div>

      {/* Event details modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-xl font-bold text-gray-900">
                Event Details
              </h2>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {selectedEvent.invitation_image_url && (
              <img
                src={selectedEvent.invitation_image_url}
                alt={selectedEvent.title}
                className="max-h-80 w-full object-cover"
              />
            )}

            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-900">
                {selectedEvent.title}
              </h3>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                {selectedEvent.description || "No description available."}
              </p>

              <div className="mt-5 space-y-3 text-sm text-gray-700">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-orange-500" />
                  {formatDate(selectedEvent.event_date)}
                </div>

                {selectedEvent.start_time && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-orange-500" />
                    {formatTime(selectedEvent.start_time)}
                    {selectedEvent.end_time &&
                      ` - ${formatTime(selectedEvent.end_time)}`}
                  </div>
                )}

                {selectedEvent.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-orange-500" />
                    {selectedEvent.location}
                  </div>
                )}
              </div>

              {(selectedEvent.event_photos || []).length > 0 && (
                <div className="mt-7">
                  <h4 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                    <Camera className="h-5 w-5 text-orange-500" />
                    Event Photos
                  </h4>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {selectedEvent.event_photos?.map((photo) => (
                      <button
                        type="button"
                        key={photo.id}
                        onClick={() => setSelectedPhoto(photo.photo_url)}
                        className="overflow-hidden rounded-lg"
                      >
                        <img
                          src={photo.photo_url}
                          alt={selectedEvent.title}
                          className="h-32 w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-size photo */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedPhoto(null)}
            className="absolute right-5 top-5 rounded-full bg-white/20 p-3 text-white hover:bg-white/30"
          >
            <X className="h-6 w-6" />
          </button>

          <img
            src={selectedPhoto}
            alt="Event photo"
            className="max-h-[85vh] max-w-full rounded-xl object-contain"
          />
        </div>
      )}
    </main>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-50">
        <ImageIcon className="h-7 w-7 text-orange-500" />
      </div>
      <p className="mt-4 text-sm font-medium text-gray-700">{message}</p>
    </div>
  );
}
