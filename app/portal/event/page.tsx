
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
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
  event_id: string;
  image_url: string;
  alt_text?: string | null;
  sort_order?: number;
};

type CompanyEvent = {
  id: string;
  title: string;
  description?: string | null;
  event_date: string;
  end_date?: string | null;
  location?: string | null;
  status: "published" | "cancelled" | "draft";
  media: EventPhoto[];
};

type EventsResponse = {
  success?: boolean;
  events?: CompanyEvent[];
  data?: CompanyEvent[];
  error?: string;
};

function formatDate(date: string) {
  if (!date) return "--";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "--";

  return parsedDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

// Compare calendar dates in the India timezone.
function getEventDateKey(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsedDate);
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

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(
    null
  );

  // --------------------------------------------------
  // LOAD EVENTS
  // --------------------------------------------------

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

        const contentType =
          response.headers.get("content-type") || "";

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
          console.error("EVENT API RESPONSE:", result);

          throw new Error(
            result.error ||
              `Unable to load events. Status: ${response.status}`
          );
        }

        if (active) {
          const receivedEvents =
            result.events || result.data || [];

          const publishedEvents = receivedEvents
            .filter(
              (event) => event.status === "published"
            )
            .map((event) => ({
              ...event,
              media: Array.isArray(event.media)
                ? [...event.media].sort(
                    (a, b) =>
                      (a.sort_order ?? 0) -
                      (b.sort_order ?? 0)
                  )
                : [],
            }));

          setEvents(publishedEvents);
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

  // --------------------------------------------------
  // UPCOMING AND PAST EVENTS
  // --------------------------------------------------

  const todayKey = getEventDateKey(new Date().toISOString());

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((event) => {
          const eventDate = getEventDateKey(
            event.event_date
          );

          return eventDate && eventDate >= todayKey;
        })
        .sort(
          (a, b) =>
            new Date(a.event_date).getTime() -
            new Date(b.event_date).getTime()
        ),
    [events, todayKey]
  );

  const pastEvents = useMemo(
    () =>
      events
        .filter((event) => {
          const eventDate = getEventDateKey(
            event.event_date
          );

          return eventDate && eventDate < todayKey;
        })
        .sort(
          (a, b) =>
            new Date(b.event_date).getTime() -
            new Date(a.event_date).getTime()
        ),
    [events, todayKey]
  );

  // --------------------------------------------------
  // ALL EVENT PHOTOS
  // --------------------------------------------------

  const allPhotos = useMemo(
    () =>
      events.flatMap((event) =>
        (event.media || []).map((photo) => ({
          ...photo,
          eventTitle: event.title,
          eventDate: event.event_date,
        }))
      ),
    [events]
  );

  // --------------------------------------------------
  // EVENT CARD
  // --------------------------------------------------

  function EventCard({ event }: { event: CompanyEvent }) {
    const firstPhoto = event.media?.[0];

    const isUpcoming =
      getEventDateKey(event.event_date) >= todayKey;

    return (
      <button
        type="button"
        onClick={() => setSelectedEvent(event)}
        className="group overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
      >
        {/* Event Image */}

        <div className="relative h-48 overflow-hidden bg-gray-100">
          {firstPhoto?.image_url ? (
            <img
              src={firstPhoto.image_url}
              alt={firstPhoto.alt_text || event.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-100 to-pink-100">
              <PartyPopper className="h-12 w-12 text-orange-500" />
            </div>
          )}

          <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow">
            {isUpcoming ? "Upcoming" : "Completed"}
          </span>

          {event.media.length > 1 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
              <Camera className="mr-1 inline h-3.5 w-3.5" />
              {event.media.length} Photos
            </span>
          )}
        </div>

        {/* Event Information */}

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

  // --------------------------------------------------
  // PAGE UI
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* Page Heading */}

        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <CalendarHeart className="h-7 w-7 text-orange-500" />

              <h1 className="text-2xl font-bold text-gray-900">
                Company Events
              </h1>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Stay connected with celebrations and activities
              happening across our company.
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
                setActiveTab(
                  tab.id as "upcoming" | "past" | "gallery"
                )
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

        {/* Upcoming Events */}

        {!loading &&
          !error &&
          activeTab === "upcoming" && (
            <>
              {upcomingEvents.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {upcomingEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState message="No upcoming events right now." />
              )}
            </>
          )}

        {/* Past Events */}

        {!loading && !error && activeTab === "past" && (
          <>
            {pastEvents.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {pastEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No past events available." />
            )}
          </>
        )}

        {/* Photo Gallery */}

        {!loading &&
          !error &&
          activeTab === "gallery" && (
            <>
              {allPhotos.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {allPhotos.map((photo) => (
                    <button
                      type="button"
                      key={photo.id}
                      onClick={() =>
                        setSelectedPhoto(photo.image_url)
                      }
                      className="group overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm"
                    >
                      <div className="h-40 overflow-hidden bg-gray-100">
                        <img
                          src={photo.image_url}
                          alt={
                            photo.alt_text ||
                            photo.eventTitle
                          }
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

      {/* --------------------------------------------------
          EVENT DETAILS MODAL
      -------------------------------------------------- */}

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

            {/* Event Main Image */}

            {selectedEvent.media?.[0]?.image_url && (
              <img
                src={selectedEvent.media[0].image_url}
                alt={
                  selectedEvent.media[0].alt_text ||
                  selectedEvent.title
                }
                className="max-h-80 w-full object-cover"
              />
            )}

            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-900">
                {selectedEvent.title}
              </h3>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                {selectedEvent.description ||
                  "No description available."}
              </p>

              {/* Event Information */}

              <div className="mt-5 space-y-3 text-sm text-gray-700">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-orange-500" />

                  {formatDate(selectedEvent.event_date)}
                </div>

                {selectedEvent.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-orange-500" />

                    {selectedEvent.location}
                  </div>
                )}
              </div>

              {/* All Event Photos */}

              {(selectedEvent.media || []).length > 0 && (
                <div className="mt-7">
                  <h4 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                    <Camera className="h-5 w-5 text-orange-500" />

                    Event Photos
                  </h4>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {selectedEvent.media.map((photo) => (
                      <button
                        type="button"
                        key={photo.id}
                        onClick={() =>
                          setSelectedPhoto(photo.image_url)
                        }
                        className="overflow-hidden rounded-lg"
                      >
                        <img
                          src={photo.image_url}
                          alt={
                            photo.alt_text ||
                            selectedEvent.title
                          }
                          className="h-32 w-full object-cover transition hover:scale-105"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedEvent.media.length === 0 && (
                <p className="mt-6 text-sm text-gray-400">
                  No photos uploaded for this event.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------
          FULL-SIZE PHOTO PREVIEW
      -------------------------------------------------- */}

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

// --------------------------------------------------
// EMPTY STATE
// --------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-50">
        <ImageIcon className="h-7 w-7 text-orange-500" />
      </div>

      <p className="mt-4 text-sm font-medium text-gray-700">
        {message}
      </p>
    </div>
  );
}
