import asyncio
import sys
import json
import os

from openai import AsyncOpenAI
from pathlib import Path
from mcp import Client, StdioServerParameters
from mcp.types import TextContent

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

    async with Client(server_params) as client:

        # Get available MCP tools
        tools_result = await client.list_tools()
        llm_tools = convert_mcp_tools(tools_result.tools)

        # Create the initial message
        messages = [
            {
                "role": "user",
                "content": f"Retrieve the details of investigation with ID {investigation_id}."
            }
        ]

        # Send the first request to MODEL
        response = await llm_client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=llm_tools,
            tool_choice="auto",
        )

        # Get the tool requested by the model
        message = response.choices[0].message

        if not message.tool_calls or len(message.tool_calls) != 1:
            raise RuntimeError("Expected exactly one tool call.")

        tool_call = message.tool_calls[0]
        tool_name = tool_call.function.name
        arguments = json.loads(tool_call.function.arguments)

        # Validate the tool and its arguments
        if tool_name != "get_investigation":
            raise RuntimeError("Unexpected tool requested.")
        if arguments != {"investigation_id": investigation_id}:
            raise RuntimeError("Unexpected tool arguments.")

        # Execute the tool through MCP
        result = await client.call_tool(
            tool_name,
            arguments
        )

        # Check the MCP result
        if result.is_error:
            raise RuntimeError(f"MCP tool failed: {result.content}")
        if not result.content or not isinstance(result.content[0], TextContent):
            raise RuntimeError("Expected text result from MCP.")

        tool_result = result.content[0].text

        # Add the model's tool request to messages
        messages.append(
            message.model_dump(
                include={"role", "content", "tool_calls"},
                exclude_none=True
            )
        )

        # Add the MCP result to messages
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": tool_result
        })

        # Send the tool result back to NVIDIA
        final_response = await llm_client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=llm_tools,
            tool_choice="none",
        )

        # Return the model's answer
        final_text = final_response.choices[0].message.content

        print("AI response:", final_text)
        
        return final_text

# if __name__ == "__main__":
#     asyncio.run(main())
