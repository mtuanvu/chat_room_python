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

    useEffect(() => {
        // Tải thông tin phòng từ localStorage nếu có
        const storedRoomId = localStorage.getItem("roomId");
        const storedNickname = localStorage.getItem("nickname");
        const storedMessages = localStorage.getItem("messages");

        if (storedRoomId && storedNickname) {
            setRoomId(storedRoomId);
            setNickname(storedNickname);
            setInRoom(true);
            if (storedMessages) {
                setMessages(JSON.parse(storedMessages));
            }
        }

        // Nếu đã vào phòng trước đó, cố gắng kết nối lại
        if (inRoom) {
            ws.current = new WebSocket(`ws://localhost:8000/ws/${roomId}/${nickname}`);
            ws.current.onopen = () => console.log("Connected to WebSocket server");
            ws.current.onmessage = (event) => {
                const messageData = JSON.parse(event.data);
                setMessages((prev) => [...prev, `${messageData.nickname}: ${messageData.content}`]);
                // Cập nhật lại lịch sử tin nhắn vào localStorage
                localStorage.setItem("messages", JSON.stringify([...messages, `${messageData.nickname}: ${messageData.content}`]));
            };
            ws.current.onclose = () => console.log("Disconnected from WebSocket server");
        }

        return () => {
            if (ws.current) ws.current.close();  // Đóng kết nối WebSocket khi component unmount
        };
    }, [inRoom, roomId, nickname]);  // Thêm dependencies cho useEffect

    const createRoom = async () => {
        try {
            const response = await fetch("http://localhost:8000/create_room", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ room_id: roomId, password: password }),
            });
            if (response.ok) {
                message.success(`Room ${roomId} created successfully`);
                // Lưu thông tin phòng vào localStorage
                localStorage.setItem("roomId", roomId);
                localStorage.setItem("nickname", nickname);
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
                // Lưu thông tin phòng vào localStorage
                localStorage.setItem("roomId", roomId);
                localStorage.setItem("nickname", nickname);
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
            const messageList = history.map(msg => `${msg.nickname}: ${msg.content}`);
            setMessages(messageList);
            // Lưu lịch sử tin nhắn vào localStorage
            localStorage.setItem("messages", JSON.stringify(messageList));
        } catch (error) {
            console.error("Failed to load history:", error);
        }
    };

    const sendMessage = () => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            setMessages((prev) => [...prev, `${nickname}: ${input}`]);
            ws.current.send(input);
            setInput("");
            // Cập nhật lại lịch sử tin nhắn vào localStorage
            localStorage.setItem("messages", JSON.stringify([...messages, `${nickname}: ${input}`]));
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
        // Xóa thông tin phòng khỏi localStorage
        localStorage.removeItem("roomId");
        localStorage.removeItem("nickname");
        localStorage.removeItem("messages");
    };

    return (
        <div style={{ padding: "20px" }}>
            <Title level={2}>Chat Room</Title>
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
