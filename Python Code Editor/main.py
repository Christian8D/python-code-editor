"""Café register: manage orders and inventory."""

STARTING_STOCK = 10

# Menu items and their prices
menu_items = {
    "cappuccino": 5.00,
    "latte": 4.50,
    "espresso": 3.00,
    "americano": 3.00,
    "sandwich": 7.50,
}

# Each item starts with 10 units in stock
stock = {item: STARTING_STOCK for item in menu_items}


def show_welcome() -> None:
    """Show a quick terminal-style welcome for Unit 2."""
    print(
        r"""
  ________________________________________________
 /                                                \
|   __        __     _                            |
|   \ \      / /__  | | ___ ___  _ __ ___   ___   |
|    \ \ /\ / / _ \ | |/ __/ _ \| '_ ` _ \ / _ \  |
|     \ V  V /  __/ | | (_| (_) | | | | | |  __/  |
|      \_/\_/ \___| |_|\___\___/|_| |_| |_|\___|  |
|                                                 |
|            >>>  TO  UNIT  2  <<<                |
|   ==========================================    |
|   #  Python Code Editor  |  press Run  #        |
|   ==========================================    |
 \________________________________________________/
"""
    )


def show_menu() -> None:
    """Display menu prices and remaining inventory."""
    print("\nAvailable menu items:")

    for number, (item, price) in enumerate(menu_items.items(), start=1):
        available = stock[item]

        if available == 0:
            print(f"{number}. {item}: SOLD OUT")
        else:
            print(
                f"{number}. {item}: ${price:.2f} "
                f"({available} left)"
            )

    print("0. Finish order")


def read_item_choice() -> str:
    """Return a menu item, FINISH, or empty string for invalid input."""
    raw_choice = input("Enter item number: ").strip()

    if not raw_choice.isdigit():
        print("Please enter a valid item number.")
        return ""

    item_number = int(raw_choice)

    if item_number == 0:
        return "FINISH"

    item_names = list(menu_items)

    if item_number < 1 or item_number > len(item_names):
        print("That number is not on the menu.")
        return ""

    return item_names[item_number - 1]


def read_quantity(item_name: str) -> int | None:
    """Read a positive quantity that is available in stock."""
    try:
        quantity = int(input("Enter quantity: "))
    except ValueError:
        print("Please enter a valid whole number.")
        return None

    if quantity <= 0:
        print("Please enter a positive quantity.")
        return None

    available = stock[item_name]

    if quantity > available:
        print(f"Only {available} {item_name}(s) left.")
        return None

    return quantity


def wants_more_items() -> bool:
    """Ask whether the customer wants to order more items."""
    while True:
        print("\nDo you want to add more items?")
        print("1) Yes")
        print("2) No")

        choice = input("Enter your choice: ").strip()

        if choice == "1":
            return True

        if choice == "2":
            return False

        print("Please enter 1 for yes or 2 for no.")


def take_order() -> None:
    """Take a customer order and update inventory."""

    # Customer information
    while True:
        customer_name = input(
            "\nEnter customer name: "
        ).strip()

        if customer_name:
            break

        print("Please enter your name.")

    print(f"\nWelcome to our cafecito, {customer_name}!")

    # Store purchased items and running total
    lines: list[tuple[str, int, float]] = []
    order_total = 0.0

    while True:
        show_menu()

        item_name = read_item_choice()
        if item_name == "":
            continue
        if item_name == "FINISH":
            break
        if stock[item_name] == 0:
            print(f"Sorry, {item_name} is sold out.")
            continue
        quantity = read_quantity(item_name)
        if quantity is None:
            continue

        # Arithmetic operator (*) multiplies price by quantity
        line_cost = menu_items[item_name] * quantity

        # Compound assignment (-=) subtracts purchased stock
        stock[item_name] -= quantity

        # Compound assignment (+=) adds cost to the running total
        order_total += line_cost

        # Store the order information
        lines.append((item_name, quantity, line_cost))
        print(
            f"\nAdded {quantity} unit(s) of {item_name}. "
            f"Line total: ${line_cost:.2f}. "
            f"{stock[item_name]} left."
        )
        if not wants_more_items():
            break

    # Handle empty orders
    if not lines:
        print("\nNo items ordered.")
        return

    # Display formatted receipt
    print("\n" + "=" * 35)
    print("         CAFÉ RECEIPT")
    print("=" * 35)
    print(f"Customer: {customer_name}")
    print("-" * 35)

    for item_name, quantity, line_cost in lines:
        print(
            f"{quantity} x {item_name:<18} "
            f"${line_cost:>6.2f}"
        )

    print("-" * 35)
    print(f"TOTAL: ${order_total:.2f}")
    print("=" * 35)


def show_stock() -> None:
    """Display the remaining inventory."""
    print("\nStock on hand:")

    for item, remaining in stock.items():
        print(f"  {item}: {remaining}")


def main() -> None:
    """Keep the cafecito register open for multiple customers."""
    show_welcome()
    print(
        f"Register open. Every item starts "
        f"with {STARTING_STOCK} in stock."
    )

    show_stock()
    while True:
        take_order()
        show_stock()

        another = input(
            "\nServe another customer? (yes/no): "
        ).lower().strip()

        if another != "yes":
            print("\nRegister closed. Goodbye!")
            break


if __name__ == "__main__":
    main()
