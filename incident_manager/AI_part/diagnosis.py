import asyncio
import sys
import json
import os

from openai import AsyncOpenAI
from pathlib import Path
from mcp import Client, StdioServerParameters
from mcp.types import TextContent

from diagnosis_queries import get_investigation

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




async def diagnose(investigation_id: int):

    # Check the investigation before starting AI
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

            # Stop if the model has finished
            if not message.tool_calls:
                if not tool_executed or not message.content:
                    raise RuntimeError("AI returned no valid tool-based answer.")

                print("AI response:", message.content)
                return message.content

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

                # Convert JSON arguments to a dictionary
                try:
                    arguments = json.loads(tool_call.function.arguments)
                except (json.JSONDecodeError, TypeError) as exc:
                    raise RuntimeError("Invalid tool arguments.") from exc

                # Allow tools only for the current investigation
                if tool_name in ("get_investigation", "get_evidences"):
                    expected = {"investigation_id": investigation_id}
                elif tool_name in ("get_incident", "get_incident_alerts"):
                    expected = {"incident_id": incident_id}
                else:
                    raise RuntimeError(f"Tool not allowed: {tool_name}")

                if arguments != expected:
                    raise RuntimeError("Tool arguments not allowed.")

                # Execute the tool through MCP
                result = await client.call_tool(tool_name, arguments)

                if result.is_error:
                    raise RuntimeError(f"MCP tool failed: {result.content}")

                if not result.content or not isinstance(result.content[0], TextContent):
                    raise RuntimeError("Invalid MCP result.")

                tool_result = result.content[0].text

                print("Executed:", tool_name, arguments)

                # Add the MCP result to messages
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result
                })

                tool_executed = True

        # Stop if the model keeps requesting tools
        raise RuntimeError("Agent reached the maximum number of rounds.")
