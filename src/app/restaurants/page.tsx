import RestaurantWishlistDashboard from "@/components/RestaurantWishlistDashboard";
import { listRestaurantWishlist } from "@/lib/restaurantWishlistDb";

export const dynamic = "force-dynamic";

export default function RestaurantsPage() {
  return <RestaurantWishlistDashboard initialRecords={listRestaurantWishlist()} />;
}
