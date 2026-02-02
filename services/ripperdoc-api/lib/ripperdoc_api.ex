# Ripperdoc Scheduling API - Night City Street Surgeons
#
# A minimal Elixir API for booking cyberware installation appointments.
# Uses Plug + Bandit for a lightweight HTTP server.

defmodule RipperdocApi.Application do
  use Application

  def start(_type, _args) do
    # Create ETS table for appointments
    :ets.new(:appointments, [:set, :public, :named_table])
    :ets.new(:ripperdocs, [:set, :public, :named_table])

    # Seed ripperdocs
    seed_ripperdocs()

    children = [
      {Bandit, plug: RipperdocApi.Router, port: 8001}
    ]

    IO.puts("\n═══════════════════════════════════════════════════════")
    IO.puts("RIPPERDOC SCHEDULING API")
    IO.puts("Night City Street Surgeons Network")
    IO.puts("Port: 8001")
    IO.puts("═══════════════════════════════════════════════════════\n")

    opts = [strategy: :one_for_one, name: RipperdocApi.Supervisor]
    Supervisor.start_link(children, opts)
  end

  defp seed_ripperdocs do
    ripperdocs = [
      {"DOC-001", %{
        id: "DOC-001",
        name: "Viktor Vektor",
        location: "Watson, Little China",
        specialty: "Optics & Neural",
        rating: 4.8,
        base_fee: 5000,
        available: true
      }},
      {"DOC-002", %{
        id: "DOC-002",
        name: "Cassius Ryder",
        location: "Westbrook, Charter Hill",
        specialty: "Combat Implants",
        rating: 4.5,
        base_fee: 7500,
        available: true
      }},
      {"DOC-003", %{
        id: "DOC-003",
        name: "Nina Kraviz",
        location: "Pacifica, West Wind Estate",
        specialty: "Budget Chrome",
        rating: 3.9,
        base_fee: 2500,
        available: true
      }},
      {"DOC-004", %{
        id: "DOC-004",
        name: "Fingers",
        location: "Japantown, Jig-Jig Street",
        specialty: "Questionable Ethics",
        rating: 2.1,
        base_fee: 1000,
        available: true
      }}
    ]

    Enum.each(ripperdocs, fn {id, doc} -> :ets.insert(:ripperdocs, {id, doc}) end)
  end
end

defmodule RipperdocApi.Router do
  use Plug.Router

  plug Plug.Logger
  plug :match
  plug Plug.Parsers, parsers: [:json], json_decoder: Jason
  plug :dispatch

  # Health check
  get "/health" do
    send_json(conn, 200, %{status: "online", location: "Night City", year: 2077})
  end

  # List all ripperdocs
  get "/ripperdocs" do
    docs = :ets.tab2list(:ripperdocs) |> Enum.map(fn {_id, doc} -> doc end)
    send_json(conn, 200, %{ripperdocs: docs})
  end

  # Create appointment
  post "/appointments" do
    with {:ok, body} <- validate_appointment(conn.body_params) do
      appointment = create_appointment(body)
      IO.puts("[RIPPERDOC API] ✓ Appointment created: #{appointment.appointment_id}")
      IO.puts("[RIPPERDOC API]   Doc: #{appointment.ripperdoc_name}, Time: #{appointment.scheduled_time}")
      send_json(conn, 201, appointment)
    else
      {:error, reason} ->
        send_json(conn, 400, %{error: "validation_error", message: reason})
    end
  end

  # Get appointment
  get "/appointments/:id" do
    case :ets.lookup(:appointments, id) do
      [{_id, appointment}] ->
        send_json(conn, 200, appointment)
      [] ->
        send_json(conn, 404, %{error: "not_found", message: "Appointment #{id} not found. Wrong clinic?"})
    end
  end

  # Cancel appointment
  delete "/appointments/:id" do
    case :ets.lookup(:appointments, id) do
      [{_id, appointment}] ->
        reason = get_in(conn.body_params, ["reason"]) || "cancelled"
        updated = %{appointment | status: "cancelled", cancellation_reason: reason}
        :ets.insert(:appointments, {id, updated})

        # Determine if deposit is refunded (only if cancelled > 1 hour before)
        deposit_refunded = appointment.status == "scheduled"

        result = %{
          appointment_id: id,
          cancelled_at: DateTime.utc_now() |> DateTime.to_iso8601(),
          reason: reason,
          deposit_refunded: deposit_refunded
        }

        IO.puts("[RIPPERDOC API] ✓ Appointment #{id} cancelled. Reason: #{reason}")
        send_json(conn, 200, result)
      [] ->
        send_json(conn, 404, %{error: "not_found", message: "Appointment #{id} not found"})
    end
  end

  match _ do
    send_json(conn, 404, %{error: "not_found", message: "Route not found, choom"})
  end

  # Helpers

  defp send_json(conn, status, data) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(status, Jason.encode!(data))
  end

  defp validate_appointment(params) do
    required = ["runner_id", "runner_handle", "cyberware_name", "cyberware_grade"]
    missing = Enum.filter(required, fn key -> is_nil(params[key]) end)

    if Enum.empty?(missing) do
      {:ok, params}
    else
      {:error, "Missing required fields: #{Enum.join(missing, ", ")}"}
    end
  end

  defp create_appointment(params) do
    # Select ripperdoc based on preference or cyberware grade
    ripperdoc = select_ripperdoc(params["preferred_ripperdoc"], params["cyberware_grade"])

    # Calculate surgery fee based on grade
    surgery_fee = calculate_surgery_fee(ripperdoc.base_fee, params["cyberware_grade"])

    # Deposit is 20% of surgery fee
    deposit = surgery_fee * 0.2

    appointment_id = "APT-#{:erlang.system_time(:millisecond)}-#{:rand.uniform(9999)}"
    scheduled_time = DateTime.utc_now() |> DateTime.add(3600, :second) |> DateTime.to_iso8601()

    appointment = %{
      appointment_id: appointment_id,
      runner_id: params["runner_id"],
      runner_handle: params["runner_handle"],
      ripperdoc_id: ripperdoc.id,
      ripperdoc_name: ripperdoc.name,
      location: ripperdoc.location,
      cyberware_name: params["cyberware_name"],
      cyberware_grade: params["cyberware_grade"],
      installation_type: determine_installation_type(params["cyberware_grade"]),
      scheduled_time: scheduled_time,
      surgery_fee: surgery_fee,
      deposit_paid: deposit,
      status: "scheduled",
      cancellation_reason: nil
    }

    :ets.insert(:appointments, {appointment_id, appointment})
    appointment
  end

  defp select_ripperdoc(nil, grade) do
    # Auto-select based on grade
    docs = :ets.tab2list(:ripperdocs) |> Enum.map(fn {_id, doc} -> doc end)

    case grade do
      "milspec" -> Enum.find(docs, fn d -> d.name == "Viktor Vektor" end)
      "corporate" -> Enum.find(docs, fn d -> d.name == "Cassius Ryder" end)
      "street" -> Enum.find(docs, fn d -> d.name == "Nina Kraviz" end)
      _ -> Enum.random(docs)
    end
  end

  defp select_ripperdoc(preferred_id, _grade) do
    case :ets.lookup(:ripperdocs, preferred_id) do
      [{_id, doc}] -> doc
      [] ->
        :ets.tab2list(:ripperdocs) |> Enum.map(fn {_id, doc} -> doc end) |> List.first()
    end
  end

  defp calculate_surgery_fee(base_fee, grade) do
    multiplier = case grade do
      "milspec" -> 2.5
      "corporate" -> 2.0
      "street" -> 1.0
      _ -> 1.5
    end
    base_fee * multiplier
  end

  defp determine_installation_type(grade) do
    case grade do
      "milspec" -> "precision"
      "corporate" -> "standard"
      "street" -> "quick"
      _ -> "standard"
    end
  end
end
