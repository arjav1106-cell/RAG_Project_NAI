import asyncio

import httpx
import pytest

from app.services.ollama import OllamaClient, OllamaUnavailable


class FakeResponse:
    def __init__(self, body):
        self.body = body

    def raise_for_status(self):
        return None

    def json(self):
        return self.body


def test_ollama_client_uses_embedding_and_chat_endpoints(monkeypatch):
    requests = []

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, json):
            requests.append((url, json))
            if url.endswith("/api/embed"):
                return FakeResponse({"embeddings": [[0.25] * 768]})
            return FakeResponse({"message": {"content": "Answer from the source. [C1]"}})

    monkeypatch.setattr("app.services.ollama.httpx.AsyncClient", FakeAsyncClient)
    client = OllamaClient(base_url="http://ollama.test")

    vector = asyncio.run(client.embed("Policy wording"))
    answer = asyncio.run(
        client.answer(
            "What applies?",
            [{"citation_id": "C1", "title": "Policy", "location": "Page 2", "content": "Terms"}],
        )
    )

    assert len(vector) == 768
    assert answer == "Answer from the source. [C1]"
    assert requests[0][0] == "http://ollama.test/api/embed"
    assert requests[0][1]["input"] == "Policy wording"
    assert requests[1][0] == "http://ollama.test/api/chat"
    assert requests[1][1]["stream"] is False
    assert requests[1][1]["messages"][0]["role"] == "system"


def test_ollama_client_rejects_wrong_embedding_dimensions(monkeypatch):
    class FakeAsyncClient:
        def __init__(self, timeout):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, _url, json):
            return FakeResponse({"embeddings": [[0.25] * 7]})

    monkeypatch.setattr("app.services.ollama.httpx.AsyncClient", FakeAsyncClient)

    with pytest.raises(OllamaUnavailable, match="Expected a 768-dimensional"):
        asyncio.run(OllamaClient(base_url="http://ollama.test").embed("Policy wording"))


def test_ollama_client_reports_service_errors(monkeypatch):
    class FakeAsyncClient:
        def __init__(self, timeout):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, _url, json):
            raise httpx.ConnectError("offline")

    monkeypatch.setattr("app.services.ollama.httpx.AsyncClient", FakeAsyncClient)

    with pytest.raises(OllamaUnavailable, match="Ollama embeddings are unavailable"):
        asyncio.run(OllamaClient(base_url="http://ollama.test").embed("Policy wording"))
