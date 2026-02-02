defmodule RipperdocApi.MixProject do
  use Mix.Project

  def project do
    [
      app: :ripperdoc_api,
      version: "2077.1.0",
      elixir: "~> 1.14",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger],
      mod: {RipperdocApi.Application, []}
    ]
  end

  defp deps do
    [
      {:plug, "~> 1.15"},
      {:bandit, "~> 1.2"},
      {:jason, "~> 1.4"}
    ]
  end
end
