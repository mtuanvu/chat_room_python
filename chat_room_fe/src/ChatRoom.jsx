import React, { useState, useEffect, useRef } from "react";
import { Button, Input, message, Typography } from "antd";

const { Title } = Typography;

const ChatRoom = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [roomId, setRoomId] = useState("");
    const [password, setPassword] = useState("");
    const [nickname, setNickname] = useState("");
    const [inRoom, setInRoom] = useState(false);
    const ws = useRef(null);

    const createRoom = async () => {
        try {
            const response = await fetch("http://localhost:8000/create_room", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ room_id: roomId, password: password }),
            });
            if (response.ok) {
                message.success(`Room ${roomId} created successfully`);
            } else {
                message.error("Failed to create room");
            }
        } catch (error) {
            console.error("Failed to create room:", error);
        }
    };

    const joinRoom = async () => {
        try {
            const response = await fetch("http://localhost:8000/join_room", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ room_id: roomId, password: password }),
            });
            if (response.ok) {
                setInRoom(true);
                loadHistory();

                ws.current = new WebSocket(`ws://localhost:8000/ws/${roomId}/${nickname}`);
                ws.current.onopen = () => console.log("Connected to WebSocket server");
                ws.current.onmessage = (event) => {
                    const messageData = JSON.parse(event.data);
                    setMessages((prev) => [...prev, `${messageData.nickname}: ${messageData.content}`]);
                };
                ws.current.onclose = () => console.log("Disconnected from WebSocket server");
            } else {
                message.error("Invalid Room ID or Password");
            }
        } catch (error) {
            console.error("Failed to join room:", error);
        }
    };

    const loadHistory = async () => {
        try {
            const response = await fetch(`http://localhost:8000/history/${roomId}`);
            const history = await response.json();
            setMessages(history.map(msg => `${msg.nickname}: ${msg.content}`));
        } catch (error) {
            console.error("Failed to load history:", error);
        }
    };

    const sendMessage = () => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            setMessages((prev) => [...prev, `${nickname}: ${input}`]);
            ws.current.send(input);
            setInput("");
        } else {
            message.warning("WebSocket connection is not open.");
        }
    };

    const leaveRoom = () => {
        if (ws.current) ws.current.close();
        setInRoom(false);
        setMessages([]);
        setRoomId("");
        setPassword("");
        setNickname("");
    };

    return (
        <div style={{ padding: "20px" }}>
            <Title level={2}></Title>
            {!inRoom ? (
                <div>
                    <Title level={3}>Create or Join a Room</Title>
                    <Input
                        style={{ marginBottom: "10px" }}
                        placeholder="Room ID"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                    />
                    <Input.Password
                        style={{ marginBottom: "10px" }}
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Input
                        style={{ marginBottom: "10px" }}
                        placeholder="Nickname"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                    />
                    <Button type="primary" onClick={createRoom} style={{ marginRight: "10px" }}>
                        Create Room
                    </Button>
                    <Button type="default" onClick={joinRoom}>
                        Join Room
                    </Button>
                </div>
            ) : (
                <div>
                    <Title level={3}>Chat Room: {roomId}</Title>
                    <div style={{ border: "1px solid #ddd", padding: "10px", maxHeight: "400px", overflowY: "auto" }}>
                        {messages.map((msg, index) => (
                            <p key={index}>{msg}</p>
                        ))}
                    </div>
                    <Input
                        style={{ marginTop: "10px" }}
                        placeholder="Type a message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onPressEnter={sendMessage}
                    />
                    <Button type="primary" onClick={sendMessage} style={{ marginTop: "10px", marginRight: "10px" }}>
                        Send
                    </Button>
                    <Button danger onClick={leaveRoom} style={{ marginTop: "10px" }}>
                        Leave Room
                    </Button>
                </div>
            )}
        </div>
    );
};

export default ChatRoom;
