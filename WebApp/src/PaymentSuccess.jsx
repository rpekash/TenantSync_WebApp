import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("token"); // PayPal sends `token` as orderId

  useEffect(() => {
    if (orderId) {
      console.log(" Payment successful. Capturing order:", orderId);

      axios.post("http://localhost:8081/capture-payment", { orderId })
        .then(response => {
          console.log(" Payment Captured Successfully:", response.data);
          alert("Payment Successful! 🎉");
        })
        .catch(error => {
          console.error(" Error capturing payment:", error.response?.data || error.message);
          alert("Payment Failed to Capture. Contact Support.");
        });
    }
  }, [orderId]);

  return (
    <div className="p-6 text-center">
      <h2 className="text-2xl font-bold text-green-600"> Payment Successful!</h2>
      <p>Thank you for your payment.</p>
      <p><strong>Transaction ID:</strong> {orderId}</p>
    </div>
  );
};

export default PaymentSuccess;
