import asyncio
import sys
import json
import os

from openai import AsyncOpenAI
from pathlib import Path
from mcp import Client, StdioServerParameters
from mcp.types import TextContent
from pydantic import BaseModel, ConfigDict
from typing import Literal

from .diagnosis_queries import get_investigation
from ..database import save_ai_diagnosis

# Path to the MCP Server
PROJECT_ROOT = Path(__file__).resolve().parents[2]

server_params = StdioServerParameters(
    command=sys.executable,
    args=["-m", "incident_manager.AI_part.mcp_server"],
    cwd=str(PROJECT_ROOT),
)

BASE_URL = "https://integrate.api.nvidia.com/v1"
MODEL = "nvidia/nemotron-3.5-super-vl-120b-a12b"

llm_client = AsyncOpenAI(
    base_url=BASE_URL,

    api_key=os.environ["NVIDIA_API_KEY"],
)

def convert_mcp_tools(mcp_tools) -> list[dict]:

    llm_tools = []

    for tool in mcp_tools:

        llm_tool = {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.input_schema
            }
        }

        llm_tools.append(llm_tool)

    return llm_tools


class AIDiagnosis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str
    probable_cause: str
    confidence: Literal["low", "medium", "high"]
    evidence_ids: list[int]
    recommendations: list[str]

async def diagnose(investigation_id: int):

    # Check the investigation
    investigation = get_investigation(investigation_id)

    if investigation is None:
        raise RuntimeError("Investigation not found.")

    if investigation["status"] != "completed":
        raise RuntimeError("Investigation is not completed.")

    incident_id = investigation["incident_id"]

    async with Client(server_params) as client:

        # Discover and convert MCP tools
        tools_result = await client.list_tools()
        llm_tools = convert_mcp_tools(tools_result.tools)

        # Create the initial message
        messages = [
            {
                "role": "user",
                "content": (
                    f"Analyze investigation {investigation_id}. "
                    "Use the available tools to retrieve its incident, "
                    "alerts and evidences. Summarize verified facts only."
                )
            }
        ]

        tool_executed = False
        valid_evidence_ids = None

        # Agent loop: maximum 8 LLM requests
        for _ in range(8):

            # Ask NVIDIA what to do next
            response = await llm_client.chat.completions.create(
                model=MODEL,
                messages=messages,
                tools=llm_tools,
                tool_choice="auto",
            )

            message = response.choices[0].message

            # Generate JSON when the model finishes
            if not message.tool_calls:

                if not tool_executed or not message.content:
                    raise RuntimeError(
                        "AI returned no valid tool-based answer."
                    )

                # Keep the model's final analysis
                messages.append({
                    "role": "assistant",
                    "content": message.content
                })

                # Request the structured diagnosis
                final_messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are a network diagnostic assistant. "
                            "Generate a diagnosis using only the MCP tool results. "
                            "Do not invent measurements or evidence IDs. "
                            "If the cause is unknown, use 'insufficient evidence'. "
                            "Only reference evidence IDs returned by get_evidences. "
                            "Recommendations must be non-destructive."
                        )
                    },
                    *messages
                ]

                final_response = await llm_client.chat.completions.create(
                    model=MODEL,
                    messages=final_messages,
                    response_format={
                        "type": "json_schema",
                        "json_schema": {
                            "name": "ai_diagnosis",
                            "strict": True,
                            "schema": AIDiagnosis.model_json_schema()
                        }
                    }
                )

                # Validate the generated JSON
                final_text = final_response.choices[0].message.content

                if not final_text:
                    raise RuntimeError(
                        "AI returned an empty diagnosis."
                    )

                diagnosis = AIDiagnosis.model_validate_json(final_text)

                # Ensure the agent retrieved evidences
                if valid_evidence_ids is None:
                    raise RuntimeError(
                        "Agent did not retrieve evidences."
                    )

                # Validate evidence IDs referenced by AI
                if not set(diagnosis.evidence_ids).issubset(
                    valid_evidence_ids
                ):
                    raise RuntimeError(
                        "AI referenced invalid evidence IDs."
                    )

                # Convert the validated diagnosis to a dictionary
                diagnosis_data = diagnosis.model_dump()

                # Save the diagnosis to SQLite
                save_ai_diagnosis(investigation_id, diagnosis_data)

                print(f"AI diagnosis saved for investigation {investigation_id}")
                print(diagnosis.model_dump_json(indent=2))

                return diagnosis_data

                            # Limit tool calls per response
            if len(message.tool_calls) > 4:
                raise RuntimeError("Too many tool calls.")

            # Remember the model's tool requests
            messages.append(
                message.model_dump(
                    include={"role", "content", "tool_calls"},
                    exclude_none=True
                )
            )

            # Execute every requested tool
            for tool_call in message.tool_calls:

                tool_name = tool_call.function.name

                # Parse tool arguments
                try:
                    arguments = json.loads(
                        tool_call.function.arguments
                    )
                except (json.JSONDecodeError, TypeError) as exc:
                    raise RuntimeError(
                        "Invalid tool arguments."
                    ) from exc

                # Allow tools only for the current investigation
                if tool_name in (
                    "get_investigation",
                    "get_evidences"
                ):
                    expected = {
                        "investigation_id": investigation_id
                    }

                elif tool_name in (
                    "get_incident",
                    "get_incident_alerts"
                ):
                    expected = {
                        "incident_id": incident_id
                    }

                else:
                    raise RuntimeError(
                        f"Tool not allowed: {tool_name}"
                    )

                if arguments != expected:
                    raise RuntimeError(
                        "Tool arguments not allowed."
                    )

                # Execute the MCP tool
                result = await client.call_tool(
                    tool_name,
                    arguments
                )

                if result.is_error:
                    raise RuntimeError(
                        f"MCP tool failed: {result.content}"
                    )

                # Extract all text blocks from MCP
                texts = [
                    item.text
                    for item in result.content
                    if isinstance(item, TextContent)
                ]

                if not texts:
                    raise RuntimeError(
                        "MCP returned no text data."
                    )

                # Process evidence results
                if tool_name == "get_evidences":

                    evidences = [
                        json.loads(text)
                        for text in texts
                    ]

                    # Handle a JSON array in a single text block
                    if (
                        len(evidences) == 1
                        and isinstance(evidences[0], list)
                    ):
                        evidences = evidences[0]

                    # Check that all records belong to this investigation
                    if any(
                        not isinstance(evidence, dict)
                        or evidence.get("investigation_id") != investigation_id
                        or not isinstance(evidence.get("id"), int)
                        for evidence in evidences
                    ):
                        raise RuntimeError(
                            "Invalid evidence records returned by MCP."
                        )

                    # Remember valid evidence IDs
                    valid_evidence_ids = {
                        evidence["id"]
                        for evidence in evidences
                    }

                    # Send all evidence records to AI
                    tool_result = json.dumps(evidences)

                    print(
                        "Evidence count sent to AI:",
                        len(evidences)
                    )

                else:

                    if len(texts) != 1:
                        raise RuntimeError(
                            "Unexpected MCP response format."
                        )

                    tool_result = texts[0]

                print("Executed:", tool_name, arguments)

                # Add MCP result to conversation
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result
                })

                tool_executed = True

        # Stop if the model keeps requesting tools
        raise RuntimeError(
            "Agent reached the maximum number of rounds."
        )
